import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { CheckCircle, Vote } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { CommitteeTabs } from "../components/CommitteeTabs";
import { supabase } from "../utils/supabase";
import { formatConstituency } from "../utils/constituency";

type Member = {
  user_id: string;
  role: "member" | "chair" | "co_chair" | "ranking_member";
  profile: { display_name: string | null; party: string | null; constituency_name: string | null; avatar_url: string | null } | null;
};

type LeadershipPosition = "chair" | "ranking_member";

function partyAbbr(party: string | null | undefined) {
  const normalized = String(party ?? "").toLowerCase();
  if (normalized.includes("democrat")) return "D";
  if (normalized.includes("republican")) return "R";
  if (normalized.includes("independent")) return "I";
  if (normalized.includes("green")) return "G";
  if (normalized.includes("libertarian")) return "L";
  return party?.trim()?.slice(0, 1).toUpperCase() || "I";
}

function memberDescriptor(member: Member) {
  const district = formatConstituency(member.profile?.constituency_name);
  return `Rep.-${partyAbbr(member.profile?.party)}-${district || "N/A"}`;
}

function memberParty(member: Member) {
  return String(member.profile?.party ?? "Independent").trim() || "Independent";
}

export function CommitteeLeadership() {
  const { id } = useParams();
  const committeeId = id!;
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [committee, setCommittee] = useState<{ id: string; class_id: string; name: string; description: string | null } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [votes, setVotes] = useState<Array<{ position: LeadershipPosition; voter_user_id: string; candidate_user_id: string }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setMeId(uid);
      if (!uid) return;
      const { data: prof } = await supabase.from("profiles").select("role").eq("user_id", uid).maybeSingle();
      setRole((prof as any)?.role ?? null);

      const { data: c, error: cErr } = await supabase.from("committees").select("id,class_id,name,description").eq("id", committeeId).single();
      if (cErr) throw cErr;
      setCommittee(c as any);

      const { data: memberRows, error: mErr } = await supabase.from("committee_members").select("user_id,role").eq("committee_id", committeeId);
      if (mErr) throw mErr;
      const memberIds = [...new Set((memberRows ?? []).map((m: any) => m.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,display_name,party,constituency_name,avatar_url")
        .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      setMembers((memberRows ?? []).map((m: any) => ({ ...m, profile: profileMap.get(m.user_id) ?? null })) as any);

      const { data: voteRows } = await supabase
        .from("committee_leadership_votes")
        .select("position,voter_user_id,candidate_user_id")
        .eq("committee_id", committeeId);
      setVotes((voteRows ?? []) as any);
    } catch (e: any) {
      toast.error(e.message || "Could not load committee leadership");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!committeeId) return;
    void load();
  }, [committeeId]);

  const isMember = !!meId && members.some((m) => m.user_id === meId);
  const majorityParty = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of members) counts.set(memberParty(member), (counts.get(memberParty(member)) ?? 0) + 1);
    const entries = [...counts.entries()];
    if (!entries.length) return null;
    if (new Set(entries.map(([, count]) => count)).size === 1) return null;
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0][1] > (sorted[1]?.[1] ?? 0) ? sorted[0][0] : null;
  }, [members]);

  const chairCandidates = majorityParty ? members.filter((member) => memberParty(member) === majorityParty) : members;
  const rankingCandidates = majorityParty ? members.filter((member) => memberParty(member) !== majorityParty) : [];

  const voteCount = (position: LeadershipPosition, candidateId: string) => votes.filter((vote) => vote.position === position && vote.candidate_user_id === candidateId).length;
  const myVote = (position: LeadershipPosition) => votes.find((vote) => vote.position === position && vote.voter_user_id === meId)?.candidate_user_id ?? null;
  const winnerFor = (position: LeadershipPosition) => {
    const counts = new Map<string, number>();
    for (const vote of votes.filter((row) => row.position === position)) counts.set(vote.candidate_user_id, (counts.get(vote.candidate_user_id) ?? 0) + 1);
    const winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return winner ? members.find((member) => member.user_id === winner) ?? null : null;
  };

  const castVote = async (position: LeadershipPosition, candidateId: string) => {
    if (!committee || !meId || !isMember) return;
    try {
      if (myVote(position) === candidateId) {
        const { error } = await supabase
          .from("committee_leadership_votes")
          .delete()
          .eq("committee_id", committee.id)
          .eq("voter_user_id", meId)
          .eq("position", position);
        if (error) throw error;
        setVotes((prev) => prev.filter((vote) => !(vote.voter_user_id === meId && vote.position === position)));
        toast.success("Vote withdrawn");
        return;
      }
      const { error } = await supabase.from("committee_leadership_votes").upsert(
        {
          committee_id: committee.id,
          class_id: committee.class_id,
          voter_user_id: meId,
          candidate_user_id: candidateId,
          position,
        } as any,
        { onConflict: "committee_id,voter_user_id,position" },
      );
      if (error) throw error;
      setVotes((prev) => [...prev.filter((vote) => !(vote.voter_user_id === meId && vote.position === position)), { voter_user_id: meId, candidate_user_id: candidateId, position }]);
      toast.success("Vote recorded");
    } catch (e: any) {
      toast.error(e.message || "Could not record vote");
    }
  };

  const applyWinners = async () => {
    if (role !== "teacher") return;
    const chair = winnerFor("chair");
    const ranking = winnerFor("ranking_member");
    try {
      if (chair) await supabase.from("committee_members").update({ role: "chair" } as any).eq("committee_id", committeeId).eq("user_id", chair.user_id);
      if (ranking) await supabase.from("committee_members").update({ role: "ranking_member" } as any).eq("committee_id", committeeId).eq("user_id", ranking.user_id);
      toast.success("Leadership roles applied");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not apply winners");
    }
  };

  const electionPanel = (position: LeadershipPosition, label: string, candidates: Member[]) => (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
          <p className="text-sm text-gray-600">Winner so far: {winnerFor(position)?.profile?.display_name ?? "No votes yet"}</p>
        </div>
        <Vote className="h-5 w-5 text-blue-600" />
      </div>
      <div className="space-y-3">
        {candidates.length === 0 && <div className="text-sm text-gray-500">No eligible candidates for this election.</div>}
        {candidates.map((member) => (
          <div key={`${position}:${member.user_id}`} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
            <div className="flex min-w-0 items-center gap-3">
              {member.profile?.avatar_url ? <img src={member.profile.avatar_url} className="h-10 w-10 rounded-full object-cover" /> : <DefaultAvatar className="h-10 w-10" iconClassName="h-5 w-5 text-gray-500" />}
              <div className="min-w-0">
                <Link to={`/profile/${member.user_id}`} className="truncate text-sm font-medium text-blue-600 hover:underline">{member.profile?.display_name ?? "Member"}</Link>
                <div className="text-xs text-gray-500">{memberDescriptor(member)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{voteCount(position, member.user_id)} votes</span>
              {isMember && (
                <button
                  onClick={() => void castVote(position, member.user_id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${myVote(position) === member.user_id ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {myVote(position) === member.user_id ? "Withdraw" : "Vote"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading || !committee ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-3xl font-bold text-gray-900">{committee.name}</h1>
              {role === "teacher" && (
                <button onClick={() => void applyWinners()} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                  <CheckCircle className="h-4 w-4" />
                  Apply winners
                </button>
              )}
            </div>
            <CommitteeTabs committeeId={committeeId} active="election" />

            {electionPanel("chair", "Chair Election", chairCandidates)}
            {majorityParty && electionPanel("ranking_member", "Ranking Member Election", rankingCandidates)}
          </>
        )}
      </main>
    </div>
  );
}
