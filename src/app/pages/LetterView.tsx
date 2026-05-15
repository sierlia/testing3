import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Check, Copy } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { BackButton } from "../components/BackButton";
import { supabase } from "../utils/supabase";
import { profilePath } from "../utils/profileRoute";
import { committeeDisplayName } from "../utils/committeeNames";

function displayPartyName(name: string) {
  const normalized = name.trim();
  if (/democratic( party)?$/i.test(normalized) || /^democrat(ic)?$/i.test(normalized)) return "Democratic Party";
  if (/republican( party)?$/i.test(normalized)) return "Republican Party";
  return /party$/i.test(normalized) ? normalized : `${normalized} Party`;
}

export function LetterView() {
  const { id } = useParams();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [letter, setLetter] = useState<any | null>(null);
  const [sender, setSender] = useState<any | null>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [orgRecipients, setOrgRecipients] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const { data: row } = await supabase.from("dear_colleague_letters").select("id,sender_user_id,subject,body,created_at").eq("id", id).maybeSingle();
      setLetter(row ?? null);
      setOrgRecipients([]);
      if (row) {
        const [{ data: senderProfile }, { data: recRows }, { data: orgRows }] = await Promise.all([
          supabase.from("profiles").select("user_id,display_name,party,constituency_name").eq("user_id", (row as any).sender_user_id).maybeSingle(),
          supabase.from("dear_colleague_recipients").select("recipient_user_id").eq("letter_id", id),
          supabase.from("dear_colleague_org_recipients").select("organization_type,organization_id,class_id").eq("letter_id", id),
        ]);
        setSender(senderProfile ?? null);
        const ids = (recRows ?? []).map((recipient: any) => recipient.recipient_user_id);
        const { data: recipientProfiles } = ids.length ? await supabase.from("profiles").select("user_id,display_name,party,constituency_name").in("user_id", ids) : ({ data: [] } as any);
        setRecipients(recipientProfiles ?? []);
        const orgRecipientsRows = (orgRows ?? []) as any[];
        const committeeIds = orgRecipientsRows.filter((org) => org.organization_type === "committee").map((org) => org.organization_id);
        const partyIds = orgRecipientsRows.filter((org) => org.organization_type === "party").map((org) => org.organization_id);
        const caucusIds = orgRecipientsRows.filter((org) => org.organization_type === "caucus").map((org) => org.organization_id);
        const [{ data: committees }, { data: parties }, { data: caucuses }] = await Promise.all([
          committeeIds.length ? supabase.from("committees").select("id,name").in("id", committeeIds) : ({ data: [] } as any),
          partyIds.length ? supabase.from("parties").select("id,name").in("id", partyIds) : ({ data: [] } as any),
          caucusIds.length ? supabase.from("caucuses").select("id,title").in("id", caucusIds) : ({ data: [] } as any),
        ]);
        const committeeNames = new Map(((committees ?? []) as any[]).map((committee) => [committee.id, committeeDisplayName(committee.name)]));
        const partyNames = new Map(((parties ?? []) as any[]).map((party) => [party.id, displayPartyName(party.name)]));
        const caucusNames = new Map(((caucuses ?? []) as any[]).map((caucus) => [caucus.id, caucus.title ?? "Caucus"]));
        setOrgRecipients(
          orgRecipientsRows.map((org) => {
            if (org.organization_type === "committee") return committeeNames.get(org.organization_id) ?? "Committee";
            if (org.organization_type === "party") return partyNames.get(org.organization_id) ?? "Party";
            if (org.organization_type === "caucus") return caucusNames.get(org.organization_id) ?? "Caucus";
            return "Organization";
          }),
        );
      }
      setLoading(false);
    };
    void load();
  }, [id]);

  const permalink = `${window.location.origin}${window.location.pathname}#/letters/${id}`;
  const handleCopyLink = () => {
    navigator.clipboard.writeText(permalink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <BackButton className="mb-4" />
        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-500">Loading letter...</div>
        ) : !letter ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-500">Letter not found.</div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-bold text-gray-900">{letter.subject || "Dear Colleague Letter"}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                  <span>From</span>
                  <Link to={profilePath(letter.sender_user_id)} className="font-medium text-blue-600 hover:underline">{sender?.display_name ?? "Member"}</Link>
                  <span className="text-gray-300">|</span>
                  <span>To</span>
                  <span className="font-medium text-gray-800">{[...orgRecipients, ...recipients.slice(0, Math.max(0, 4 - orgRecipients.length)).map((recipient) => recipient.display_name ?? "Member")].join(", ") || "Recipients"}</span>
                  {orgRecipients.length + recipients.length > 4 && <span className="text-gray-500">+{orgRecipients.length + recipients.length - 4} more</span>}
                  <span className="text-gray-300">|</span>
                  <span>Sent {new Date(letter.created_at).toLocaleString()}</span>
                </div>
              </div>
              <button onClick={handleCopyLink} className="flex flex-shrink-0 items-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <div className="border-t border-gray-200 pt-6">
              <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed text-gray-700">{letter.body}</pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
