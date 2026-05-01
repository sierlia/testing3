import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
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

type DocKey = { committeeId: string; billId: string; classId: string };

export class YjsSupabaseProvider {
  doc: Y.Doc;
  awareness: Awareness;
  private channel: RealtimeChannel;
  private key: DocKey;
  private destroyed = false;
  private persistTimer: number | null = null;
  private lastPersistedB64: string | null = null;
  private onSynced?: () => void;
  private hadSnapshot = false;

  constructor({ doc, awareness, key, user }: { doc: Y.Doc; awareness: Awareness; key: DocKey; user: { id: string; name: string; color: string } }, onSynced?: () => void) {
    this.doc = doc;
    this.awareness = awareness;
    this.key = key;
    this.onSynced = onSynced;

    this.channel = supabase.channel(`doc:${key.committeeId}:${key.billId}`, { config: { broadcast: { ack: false } } });

    this.awareness.setLocalStateField("user", { id: user.id, name: user.name, color: user.color });

    this.channel
      .on("broadcast", { event: "yjs-update" }, (payload) => {
        const b64 = (payload as any)?.payload?.b64 as string | undefined;
        if (!b64) return;
        const update = fromBase64(b64);
        Y.applyUpdate(this.doc, update, "remote");
      })
      .on("broadcast", { event: "yjs-awareness" }, (payload) => {
        const state = (payload as any)?.payload?.state;
        const clientID = (payload as any)?.payload?.clientID;
        if (!clientID) return;
        const current = this.awareness.getStates();
        const next = new Map(current);
        if (state === null) next.delete(clientID);
        else next.set(clientID, state);
        // @ts-expect-error internal
        this.awareness.states = next;
        this.awareness.emit("change", [{ added: [], updated: [], removed: [] }, "remote"]);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        if (this.destroyed) return;
        this.hadSnapshot = await this.hydrateFromDb();
        this.onSynced?.();
        this.broadcastAwareness();
      });

    this.doc.on("update", (update: Uint8Array, origin: any) => {
      if (this.destroyed) return;
      if (origin === "remote") return;
      this.channel.send({ type: "broadcast", event: "yjs-update", payload: { b64: toBase64(update) } });
      this.schedulePersist();
    });

    this.awareness.on("update", () => {
      if (this.destroyed) return;
      this.broadcastAwareness();
    });
  }

  private broadcastAwareness() {
    const local = this.awareness.getLocalState();
    this.channel.send({
      type: "broadcast",
      event: "yjs-awareness",
      payload: { clientID: this.doc.clientID, state: local ?? null },
    });
  }

  private schedulePersist() {
    if (this.persistTimer) window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => void this.persistToDb(), 1200);
  }

  private async hydrateFromDb(): Promise<boolean> {
    const { committeeId, billId } = this.key;
    const { data, error } = await supabase
      .from("committee_bill_docs")
      .select("ydoc_base64")
      .eq("committee_id", committeeId)
      .eq("bill_id", billId)
      .maybeSingle();
    if (error) return false;
    const b64 = (data as any)?.ydoc_base64 as string | undefined;
    if (b64) {
      this.lastPersistedB64 = b64;
      const update = fromBase64(b64);
      if (update.length) Y.applyUpdate(this.doc, update, "remote");
      return update.length > 0;
    }
    return false;
  }

  getHydratedFromSnapshot() {
    return this.hadSnapshot;
  }

  private async persistToDb() {
    const { committeeId, billId, classId } = this.key;
    const state = Y.encodeStateAsUpdate(this.doc);
    const b64 = toBase64(state);
    if (b64 === this.lastPersistedB64) return;
    this.lastPersistedB64 = b64;
    await supabase.from("committee_bill_docs").upsert({ committee_id: committeeId, bill_id: billId, class_id: classId, ydoc_base64: b64 } as any, {
      onConflict: "bill_id,committee_id",
    });
  }

  destroy() {
    this.destroyed = true;
    try {
      this.broadcastAwareness();
    } catch {
      // ignore
    }
    if (this.persistTimer) window.clearTimeout(this.persistTimer);
    void supabase.removeChannel(this.channel);
  }
}
