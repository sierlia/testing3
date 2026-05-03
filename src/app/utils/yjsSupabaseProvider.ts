import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

function toBase64(u8: Uint8Array) {
  if (typeof Buffer !== "undefined") return Buffer.from(u8).toString("base64");
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  // eslint-disable-next-line no-undef
  return btoa(s);
}

function fromBase64(b64: string) {
  if (!b64) return new Uint8Array();
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  // eslint-disable-next-line no-undef
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

type DocKey = { committeeId: string; billId: string; classId: string; documentId?: string; storageColumn?: string };

export class YjsSupabaseProvider {
  doc: Y.Doc;
  awareness: Awareness;
  private channel: RealtimeChannel;
  private key: DocKey;
  private providerId = Math.random().toString(36).slice(2);
  private destroyed = false;
  private persistTimer: number | null = null;
  private pollTimer: number | null = null;
  private syncRequestTimer: number | null = null;
  private lastPersistedB64: string | null = null;
  private lastSeenUpdatedAt: string | null = null;
  private onSynced?: () => void;
  private hadSnapshot = false;
  private isSubscribed = false;
  private pendingSends: Array<{ event: string; b64: string; extra?: Record<string, any> }> = [];

  constructor({ doc, awareness, key, user }: { doc: Y.Doc; awareness: Awareness; key: DocKey; user: { id: string; name: string; color: string } }, onSynced?: () => void) {
    this.doc = doc;
    this.awareness = awareness;
    this.key = key;
    this.onSynced = onSynced;

    const documentId = key.documentId ?? key.billId;
    this.channel = supabase.channel(`doc:${key.committeeId}:${documentId}`, { config: { broadcast: { ack: true } } });

    this.awareness.setLocalStateField("user", { id: user.id, name: user.name, color: user.color });

    this.channel
      .on("broadcast", { event: "yjs-update" }, (payload) => {
        const b64 = (payload as any)?.payload?.b64 as string | undefined;
        const senderId = (payload as any)?.payload?.senderId as string | undefined;
        if (senderId === this.providerId) return;
        if (!b64) return;
        const update = fromBase64(b64);
        // Tag remote updates with this provider instance so our update handler
        // can reliably ignore echo without depending on string origins.
        Y.applyUpdate(this.doc, update, this);
        // Persist remote updates too so the canonical snapshot is eventually written
        // even if the originating user disconnects quickly.
        this.schedulePersist();
      })
      .on("broadcast", { event: "yjs-sync-request" }, (payload) => {
        const senderId = (payload as any)?.payload?.senderId as string | undefined;
        const stateVectorB64 = (payload as any)?.payload?.stateVectorB64 as string | undefined;
        if (!senderId || senderId === this.providerId || !stateVectorB64) return;
        const update = Y.encodeStateAsUpdate(this.doc, fromBase64(stateVectorB64));
        if (update.length) {
          void this.sendBroadcast("yjs-sync-response", toBase64(update), { targetId: senderId });
        }
      })
      .on("broadcast", { event: "yjs-sync-response" }, (payload) => {
        const senderId = (payload as any)?.payload?.senderId as string | undefined;
        const targetId = (payload as any)?.payload?.targetId as string | undefined;
        const b64 = (payload as any)?.payload?.b64 as string | undefined;
        if (senderId === this.providerId || targetId !== this.providerId || !b64) return;
        const update = fromBase64(b64);
        if (update.length) {
          Y.applyUpdate(this.doc, update, this);
          this.schedulePersist();
        }
      })
      .on("broadcast", { event: "yjs-awareness" }, (payload) => {
        const b64 = (payload as any)?.payload?.b64 as string | undefined;
        if (!b64) return;
        const update = fromBase64(b64);
        // y-protocols awareness update format
        applyAwarenessUpdate(this.awareness, update, "remote");
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        if (this.destroyed) return;
        this.isSubscribed = true;
        this.hadSnapshot = await this.hydrateFromDb();
        this.startDbPolling();
        // Flush any queued broadcasts that happened before subscription.
        for (const msg of this.pendingSends.splice(0, this.pendingSends.length)) {
          void this.sendBroadcast(msg.event, msg.b64, msg.extra);
        }
        this.requestPeerSync();
        this.onSynced?.();
        this.broadcastAwareness();
      });

    this.doc.on("update", (update: Uint8Array, origin: any) => {
      if (this.destroyed) return;
      // Ignore updates applied by this provider (i.e. remote updates).
      if (origin !== this) {
        void this.sendBroadcast("yjs-update", toBase64(update));
      }
      // Persist on both local and remote updates for robustness
      this.schedulePersist();
    });

    this.awareness.on("update", () => {
      if (this.destroyed) return;
      this.broadcastAwareness();
    });
  }

  private broadcastAwareness() {
    const local = this.awareness.getLocalState();
    const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
    void this.sendBroadcast("yjs-awareness", toBase64(update), { state: local ?? null });
  }

  private async sendBroadcast(event: string, b64: string, extra?: Record<string, any>) {
    if (this.destroyed) return;
    if (!this.isSubscribed) {
      this.pendingSends.push({ event, b64, extra });
      return;
    }
    const resp = await this.channel.send({ type: "broadcast", event, payload: { b64, senderId: this.providerId, ...(extra ?? {}) } });
    if ((resp as any)?.status && (resp as any).status !== "ok") {
      // eslint-disable-next-line no-console
      console.warn("yjs broadcast send failed", event, resp);
    }
  }

  private requestPeerSync() {
    if (this.syncRequestTimer) window.clearTimeout(this.syncRequestTimer);
    const sendRequest = () => {
      if (this.destroyed || !this.isSubscribed) return;
      const stateVector = Y.encodeStateVector(this.doc);
      void this.sendBroadcast("yjs-sync-request", "", { stateVectorB64: toBase64(stateVector) });
    };
    sendRequest();
    this.syncRequestTimer = window.setTimeout(sendRequest, 500);
  }

  private schedulePersist() {
    if (this.persistTimer) window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => void this.persistToDb(), 500);
  }

  private async hydrateFromDb(): Promise<boolean> {
    const { committeeId, billId } = this.key;
    const { data, error } = await supabase
      .from("committee_bill_docs")
      .select(`${this.storageColumn()},updated_at`)
      .eq("committee_id", committeeId)
      .eq("bill_id", billId)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("committee bill doc hydrate failed", error);
      return false;
    }
    const b64 = (data as any)?.[this.storageColumn()] as string | undefined;
    this.lastSeenUpdatedAt = ((data as any)?.updated_at as string | undefined) ?? null;
    if (b64) {
      this.lastPersistedB64 = b64;
      const update = fromBase64(b64);
      // Tag hydration update as provider-origin so we don't re-broadcast it as "local"
      // which can cause reload to overwrite other clients.
      if (update.length) Y.applyUpdate(this.doc, update, this);
      return update.length > 0;
    }
    return false;
  }

  private startDbPolling() {
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    this.pollTimer = window.setInterval(() => void this.syncFromDb(), 1000);
  }

  private async syncFromDb() {
    if (this.destroyed) return;
    const { committeeId, billId } = this.key;
    const { data, error } = await supabase
      .from("committee_bill_docs")
      .select(`${this.storageColumn()},updated_at`)
      .eq("committee_id", committeeId)
      .eq("bill_id", billId)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("committee bill doc sync failed", error);
      return;
    }
    const updatedAt = ((data as any)?.updated_at as string | undefined) ?? null;
    const b64 = (data as any)?.[this.storageColumn()] as string | undefined;
    if (!b64 || !updatedAt || updatedAt === this.lastSeenUpdatedAt || b64 === this.lastPersistedB64) return;
    this.lastSeenUpdatedAt = updatedAt;
    this.lastPersistedB64 = b64;
    const update = fromBase64(b64);
    if (update.length) Y.applyUpdate(this.doc, update, this);
  }

  getHydratedFromSnapshot() {
    return this.hadSnapshot;
  }

  private async persistToDb() {
    const { committeeId, billId, classId } = this.key;
    let b64 = toBase64(Y.encodeStateAsUpdate(this.doc));
    if (b64 === this.lastPersistedB64) return;

    const { data: existing, error: readError } = await supabase
      .from("committee_bill_docs")
      .select(`${this.storageColumn()},updated_at`)
      .eq("committee_id", committeeId)
      .eq("bill_id", billId)
      .maybeSingle();
    if (readError) {
      // eslint-disable-next-line no-console
      console.warn("committee bill doc pre-persist merge failed", readError);
      return;
    }
    const existingB64 = (existing as any)?.[this.storageColumn()] as string | undefined;
    if (existingB64 && existingB64 !== b64) {
      const update = fromBase64(existingB64);
      if (update.length) {
        Y.applyUpdate(this.doc, update, this);
        b64 = toBase64(Y.encodeStateAsUpdate(this.doc));
      }
    }

    const { data, error } = await supabase
      .from("committee_bill_docs")
      .upsert({ committee_id: committeeId, bill_id: billId, class_id: classId, [this.storageColumn()]: b64 } as any, {
        onConflict: "bill_id,committee_id",
      })
      .select("updated_at")
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("committee bill doc persist failed", error);
      return;
    }
    this.lastPersistedB64 = b64;
    this.lastSeenUpdatedAt = ((data as any)?.updated_at as string | undefined) ?? this.lastSeenUpdatedAt;
  }

  private storageColumn() {
    return this.key.storageColumn ?? "ydoc_base64";
  }

  destroy() {
    this.destroyed = true;
    try {
      this.broadcastAwareness();
    } catch {
      // ignore
    }
    try {
      // Best-effort persist on teardown
      void this.persistToDb();
    } catch {
      // ignore
    }
    if (this.persistTimer) window.clearTimeout(this.persistTimer);
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    if (this.syncRequestTimer) window.clearTimeout(this.syncRequestTimer);
    void supabase.removeChannel(this.channel);
  }

  getSubscribed() {
    return this.isSubscribed;
  }
}
