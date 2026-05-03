import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Flag, Pencil, Save, Send, Users, Vote } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { formatConstituency } from "../utils/constituency";

type PartyRow = { id: string; class_id: string; name: string; platform: string; color: string; created_at: string };
type MemberRow = { user_id: string; display_name: string | null; party: string | null; constituency_name: string | null; avatar_url: string | null };
type Announcement = { id: string; author_user_id: string; body: string; created_at: string; author?: MemberRow | null };
type CommentRow = { id: string; announcement_id: string; author_user_id: string; body: string; created_at: string; author?: MemberRow | null };

export function PartyDetail() {
  const { id } = useParams();
  const partyId = id!;

  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [myParty, setMyParty] = useState<string | null>(null);
  const [party, setParty] = useState<PartyRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [comments, setComments] = useState<Record<string, CommentRow[]>>({});
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [newComment, setNewComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "district">("name");
  const [votes, setVotes] = useState<Array<{ position: "chair" | "whip"; voter_user_id: string; candidate_user_id: string }>>([]);
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");

  const isMember = !!party && myParty === party.name;
  const selectedAnnouncement = announcements.find((a) => a.id === selectedAnnouncementId) ?? null;

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setMeId(uid);
      if (!uid) return;

      const { data: p, error: pErr } = await supabase.from("parties").select("id,class_id,name,platform,color,created_at").eq("id", partyId).single();
      if (pErr) throw pErr;
      setParty(p as any);
      setAboutDraft((p as any).platform ?? "");

      const { data: me } = await supabase.from("profiles").select("party").eq("user_id", uid).maybeSingle();
      setMyParty((me as any)?.party ?? null);

      const { data: memberRows, error: memberErr } = await supabase
        .from("profiles")
        .select("user_id,display_name,party,constituency_name,avatar_url")
        .eq("class_id", (p as any).class_id)
        .eq("party", (p as any).name)
        .order("display_name", { ascending: true });
      if (memberErr) throw memberErr;
      setMembers((memberRows ?? []) as any);

      const { data: aRows, error: aErr } = await supabase
        .from("party_announcements")
        .select("id,author_user_id,body,created_at")
        .eq("party_id", partyId)
        .order("created_at", { ascending: false });
      if (aErr) throw aErr;

      const authorIds = [...new Set((aRows ?? []).map((a: any) => a.author_user_id))];
      const { data: authors } = await supabase
        .from("profiles")
        .select("user_id,display_name,party,constituency_name,avatar_url")
        .in("user_id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
      const authorMap = new Map((authors ?? []).map((a: any) => [a.user_id, a]));
      const mappedAnnouncements = (aRows ?? []).map((a: any) => ({ ...a, author: authorMap.get(a.author_user_id) ?? null }));
      setAnnouncements(mappedAnnouncements as any);
      setSelectedAnnouncementId((prev) => prev ?? mappedAnnouncements[0]?.id ?? null);

      const announcementIds = mappedAnnouncements.map((a: any) => a.id);
      if (announcementIds.length) {
        const { data: cRows } = await supabase.from("party_comments").select("id,announcement_id,author_user_id,body,created_at").in("announcement_id", announcementIds).order("created_at", { ascending: true });
        const commentAuthorIds = [...new Set((cRows ?? []).map((c: any) => c.author_user_id))];
        const { data: cAuthors } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url")
          .in("user_id", commentAuthorIds.length ? commentAuthorIds : ["00000000-0000-0000-0000-000000000000"]);
        const cAuthorMap = new Map((cAuthors ?? []).map((a: any) => [a.user_id, a]));
        const grouped: Record<string, CommentRow[]> = {};
        for (const row of cRows ?? []) {
          const comment = { ...(row as any), author: cAuthorMap.get((row as any).author_user_id) ?? null };
          grouped[comment.announcement_id] = [...(grouped[comment.announcement_id] ?? []), comment];
        }
        setComments(grouped);
      } else {
        setComments({});
      }

      const { data: voteRows } = await supabase.from("party_leadership_votes").select("position,voter_user_id,candidate_user_id").eq("party_id", partyId);
      setVotes((voteRows ?? []) as any);
    } catch (e: any) {
      toast.error(e.message || "Could not load party");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!partyId) return;
    void load();
  }, [partyId]);

  const visibleMembers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return members
      .filter((m) => {
        if (!query) return true;
        return (m.display_name ?? "Member").toLowerCase().includes(query) || formatConstituency(m.constituency_name).toLowerCase().includes(query);
      })
      .sort((a, b) =>
        sortBy === "district"
          ? formatConstituency(a.constituency_name).localeCompare(formatConstituency(b.constituency_name))
          : (a.display_name ?? "Member").localeCompare(b.display_name ?? "Member"),
      );
  }, [members, searchQuery, sortBy]);

  const leaderFor = (position: "chair" | "whip") => {
    const counts = new Map<string, number>();
    for (const vote of votes.filter((v) => v.position === position)) counts.set(v.candidate_user_id, (counts.get(v.candidate_user_id) ?? 0) + 1);
    const winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return winner ? members.find((m) => m.user_id === winner) ?? null : null;
  };

  const joinOrSwitch = async () => {
    if (!party || !meId) return;
    try {
      const { error } = await supabase.from("profiles").update({ party: party.name } as any).eq("user_id", meId);
      if (error) throw error;
      setMyParty(party.name);
      toast.success(myParty ? "Party switched" : "Joined party");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not update party");
    }
  };

  const saveAbout = async () => {
    if (!party) return;
    try {
      const { error } = await supabase.from("parties").update({ platform: aboutDraft } as any).eq("id", party.id);
      if (error) throw error;
      setParty({ ...party, platform: aboutDraft });
      setEditingAbout(false);
      toast.success("Party platform updated");
    } catch (e: any) {
      toast.error(e.message || "Could not update party");
    }
  };

  const postAnnouncement = async () => {
    if (!party || !meId || !newAnnouncement.trim()) return;
    try {
      const { error } = await supabase.from("party_announcements").insert({
        party_id: party.id,
        class_id: party.class_id,
        author_user_id: meId,
        body: newAnnouncement.trim(),
      } as any);
      if (error) throw error;
      setNewAnnouncement("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not post announcement");
    }
  };

  const postComment = async () => {
    if (!selectedAnnouncementId || !meId || !newComment.trim()) return;
    try {
      const { error } = await supabase.from("party_comments").insert({
        announcement_id: selectedAnnouncementId,
        author_user_id: meId,
        body: newComment.trim(),
      } as any);
      if (error) throw error;
      setNewComment("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not post comment");
    }
  };

  const castLeadershipVote = async (position: "chair" | "whip", candidateId: string) => {
    if (!party || !meId || !isMember) return;
    try {
      const { error } = await supabase.from("party_leadership_votes").upsert(
        {
          party_id: party.id,
          class_id: party.class_id,
          voter_user_id: meId,
          candidate_user_id: candidateId,
          position,
        } as any,
        { onConflict: "party_id,voter_user_id,position" },
      );
      if (error) throw error;
      setVotes((prev) => [...prev.filter((v) => !(v.voter_user_id === meId && v.position === position)), { voter_user_id: meId, candidate_user_id: candidateId, position }]);
      toast.success("Vote recorded");
    } catch (e: any) {
      toast.error(e.message || "Could not record vote");
    }
  };

  const voteCount = (position: "chair" | "whip", candidateId: string) => votes.filter((v) => v.position === position && v.candidate_user_id === candidateId).length;
  const myLeadershipVote = (position: "chair" | "whip") => votes.find((v) => v.position === position && v.voter_user_id === meId)?.candidate_user_id ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading || !party ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="h-2" style={{ backgroundColor: party.color || "#2563eb" }} />
              <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: party.color || "#2563eb" }}>
                      <Flag className="h-4 w-4" />
                    </span>
                    <h1 className="text-2xl font-bold text-gray-900">{party.name}</h1>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Chair: {leaderFor("chair")?.display_name ?? "N/A"} • Whip: {leaderFor("whip")?.display_name ?? "N/A"} • {members.length} members
                  </p>
                </div>
                <button
                  onClick={() => void joinOrSwitch()}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={isMember}
                  style={{ backgroundColor: isMember ? undefined : party.color || "#2563eb" }}
                >
                  {isMember ? "Joined" : myParty ? "Switch to party" : "Join party"}
                </button>
              </div>
              <div className="mt-5 border-t border-gray-200 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">About</h2>
                  {isMember && !editingAbout && (
                    <button onClick={() => setEditingAbout(true)} className="text-blue-600 hover:text-blue-700"><Pencil className="h-4 w-4" /></button>
                  )}
                </div>
                {editingAbout ? (
                  <div className="space-y-3">
                    <textarea value={aboutDraft} onChange={(e) => setAboutDraft(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2" />
                    <button onClick={() => void saveAbout()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Save className="h-4 w-4" />Save</button>
                  </div>
                ) : (
                  <p className="whitespace-pre-line text-gray-700">{party.platform || "No platform yet."}</p>
                )}
              </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 p-5">
                    <h2 className="text-lg font-semibold text-gray-900">Announcement Board</h2>
                  </div>
                  {isMember && (
                    <div className="border-b border-gray-200 p-5">
                      <div className="flex gap-3">
                        <textarea value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)} rows={3} placeholder="Post an announcement..." className="flex-1 rounded-md border border-gray-300 px-3 py-2" />
                        <button onClick={() => void postAnnouncement()} disabled={!newAnnouncement.trim()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Send className="h-4 w-4" />Post</button>
                      </div>
                    </div>
                  )}
                  <div className="grid md:grid-cols-[260px_1fr]">
                    <div className="max-h-[520px] overflow-y-auto border-r border-gray-200">
                      {announcements.length === 0 ? (
                        <div className="p-5 text-sm text-gray-500">No announcements yet.</div>
                      ) : (
                        announcements.map((a) => (
                          <button key={a.id} onClick={() => setSelectedAnnouncementId(a.id)} className={`w-full border-b border-gray-100 p-4 text-left hover:bg-gray-50 ${selectedAnnouncementId === a.id ? "bg-blue-50" : ""}`}>
                            <div className="line-clamp-2 text-sm font-medium text-gray-900">{a.body}</div>
                            <div className="mt-1 text-xs text-gray-500">{a.author?.display_name ?? "Member"} • {new Date(a.created_at).toLocaleDateString()}</div>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="max-h-[520px] overflow-y-auto p-5">
                      {selectedAnnouncement ? (
                        <div className="space-y-4">
                          <div className="rounded-md bg-gray-50 p-4">
                            <div className="whitespace-pre-line text-sm text-gray-900">{selectedAnnouncement.body}</div>
                            <div className="mt-2 text-xs text-gray-500">{selectedAnnouncement.author?.display_name ?? "Member"} • {new Date(selectedAnnouncement.created_at).toLocaleString()}</div>
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
                            {(comments[selectedAnnouncement.id] ?? []).map((comment) => (
                              <div key={comment.id} className="rounded-md border border-gray-200 p-3 text-sm">
                                <div className="font-medium text-gray-900">{comment.author?.display_name ?? "Member"}</div>
                                <div className="mt-1 text-gray-700">{comment.body}</div>
                              </div>
                            ))}
                          </div>
                          {isMember && (
                            <div className="flex gap-2 border-t border-gray-200 pt-3">
                              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} placeholder="Write a comment..." className="flex-1 rounded-md border border-gray-300 px-3 py-2" />
                              <button onClick={() => void postComment()} disabled={!newComment.trim()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Send</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Select an announcement.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Vote className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Party Leadership Elections</h2>
                  </div>
                  {(["chair", "whip"] as const).map((position) => (
                    <div key={position} className="mb-5 last:mb-0">
                      <h3 className="mb-2 text-sm font-semibold capitalize text-gray-700">{position}</h3>
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div key={`${position}:${member.user_id}`} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                            <div className="text-sm font-medium text-gray-900">{member.display_name ?? "Member"}</div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500">{voteCount(position, member.user_id)} votes</span>
                              {isMember && (
                                <button onClick={() => void castLeadershipVote(position, member.user_id)} className={`rounded px-3 py-1.5 text-xs font-medium ${myLeadershipVote(position) === member.user_id ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                                  {myLeadershipVote(position) === member.user_id ? "Voted" : "Vote"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Members</h2>
                </div>
                <div className="mb-4 flex gap-2">
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search members..." className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                    <option value="name">Name</option>
                    <option value="district">District</option>
                  </select>
                </div>
                <div className="space-y-3">
                  {visibleMembers.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3">
                      {m.avatar_url ? <img src={m.avatar_url} className="h-10 w-10 rounded-full object-cover" /> : <DefaultAvatar className="h-10 w-10" iconClassName="h-5 w-5 text-gray-500" />}
                      <div className="min-w-0 flex-1">
                        <Link to={`/profile/${m.user_id}`} className="truncate text-sm font-medium text-blue-600 hover:underline">{m.display_name ?? "Member"}</Link>
                        <div className="truncate text-xs text-gray-500">{formatConstituency(m.constituency_name)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
