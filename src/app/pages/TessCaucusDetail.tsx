import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { Save, X, Users as UsersIcon, Send, Pencil, User } from "lucide-react";
import { useParams } from "react-router";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";

type MembershipRole = "member" | "chair" | "co_chair" | "ranking_member";

type ProfileLite = {
  user_id: string;
  display_name: string | null;
  party: string | null;
  constituency_name: string | null;
  avatar_url: string | null;
};

type Announcement = {
  id: string;
  caucus_id: string;
  author_user_id: string;
  title: string;
  body: string;
  created_at: string;
  author?: ProfileLite | null;
};

type Comment = {
  id: string;
  announcement_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
  author?: ProfileLite | null;
};

export function TessCaucusDetail() {
  const { id } = useParams();
  const caucusId = id!;

  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);

  const [caucus, setCaucus] = useState<{ id: string; title: string; description: string; created_at: string } | null>(null);
  const [members, setMembers] = useState<Array<{ user_id: string; role: MembershipRole; profile: ProfileLite | null }>>([]);
  const [myRole, setMyRole] = useState<MembershipRole | null>(null);

  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState("");

  const [commentsByAnnouncement, setCommentsByAnnouncement] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState("");

  const isLeader = myRole === "chair" || myRole === "co_chair";

  const selectedAnnouncement = useMemo(
    () => announcements.find((a) => a.id === selectedAnnouncementId) ?? null,
    [announcements, selectedAnnouncementId],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id ?? null;
        setMeId(me);

        const { data: c, error: cErr } = await supabase
          .from("caucuses")
          .select("id,title,description,created_at")
          .eq("id", caucusId)
          .single();
        if (cErr) throw cErr;
        setCaucus(c);
        setAboutDraft(c.description ?? "");

        const { data: mRows, error: mErr } = await supabase
          .from("caucus_members")
          .select("user_id,role")
          .eq("caucus_id", caucusId);
        if (mErr) throw mErr;

        const memberIds = [...new Set((mRows ?? []).map((m: any) => m.user_id))];
        const { data: pRows } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url")
          .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
        const pMap = new Map((pRows ?? []).map((p: any) => [p.user_id, p]));

        const mappedMembers = (mRows ?? []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role as MembershipRole,
          profile: (pMap.get(m.user_id) as ProfileLite) ?? null,
        }));
        setMembers(mappedMembers);
        setMyRole(me ? ((mRows ?? []).find((r: any) => r.user_id === me)?.role as any) ?? null : null);

        const { data: aRows, error: aErr } = await supabase
          .from("caucus_announcements")
          .select("id,caucus_id,author_user_id,title,body,created_at")
          .eq("caucus_id", caucusId)
          .order("created_at", { ascending: false });
        if (aErr) throw aErr;

        const authorIds = [...new Set((aRows ?? []).map((a: any) => a.author_user_id))];
        const { data: aAuthors } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url")
          .in("user_id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
        const aAuthorMap = new Map((aAuthors ?? []).map((p: any) => [p.user_id, p]));

        const mappedAnnouncements: Announcement[] = (aRows ?? []).map((a: any) => ({
          ...a,
          author: (aAuthorMap.get(a.author_user_id) as ProfileLite) ?? null,
        }));
        setAnnouncements(mappedAnnouncements);
        setSelectedAnnouncementId(mappedAnnouncements[0]?.id ?? null);

        // Load comments for announcements (initial)
        const announcementIds = mappedAnnouncements.map((a) => a.id);
        if (announcementIds.length) {
          const { data: cRows, error: ccErr } = await supabase
            .from("caucus_comments")
            .select("id,announcement_id,author_user_id,body,created_at")
            .in("announcement_id", announcementIds)
            .order("created_at", { ascending: true });
          if (ccErr) throw ccErr;

          const commentAuthorIds = [...new Set((cRows ?? []).map((r: any) => r.author_user_id))];
          const { data: cAuthors } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url")
            .in("user_id", commentAuthorIds.length ? commentAuthorIds : ["00000000-0000-0000-0000-000000000000"]);
          const cAuthorMap = new Map((cAuthors ?? []).map((p: any) => [p.user_id, p]));

          const grouped: Record<string, Comment[]> = {};
          for (const row of cRows ?? []) {
            const comment: Comment = {
              ...(row as any),
              author: (cAuthorMap.get((row as any).author_user_id) as ProfileLite) ?? null,
            };
            grouped[comment.announcement_id] = [...(grouped[comment.announcement_id] ?? []), comment];
          }
          setCommentsByAnnouncement(grouped);
        }
      } catch (e: any) {
        toast.error(e.message || "Could not load caucus");
      } finally {
        setLoading(false);
      }
    };

    if (!caucusId) return;
    void load();
  }, [caucusId]);

  useEffect(() => {
    if (!caucusId) return;

    const channel = supabase
      .channel(`caucus:${caucusId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "caucus_announcements", filter: `caucus_id=eq.${caucusId}` },
        async (payload) => {
          const row = payload.new as any;
          const { data: author } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url")
            .eq("user_id", row.author_user_id)
            .maybeSingle();
          setAnnouncements((prev) => [{ ...(row as any), author: (author as any) ?? null }, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "caucus_comments" },
        async (payload) => {
          const row = payload.new as any;
          const { data: author } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url")
            .eq("user_id", row.author_user_id)
            .maybeSingle();
          const comment: Comment = { ...(row as any), author: (author as any) ?? null };
          setCommentsByAnnouncement((prev) => ({
            ...prev,
            [comment.announcement_id]: [...(prev[comment.announcement_id] ?? []), comment],
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [caucusId]);

  const joinLeave = async () => {
    if (!meId) return;
    try {
      if (myRole) {
        const { error } = await supabase.from("caucus_members").delete().eq("caucus_id", caucusId).eq("user_id", meId);
        if (error) throw error;
        setMyRole(null);
        setMembers((prev) => prev.filter((m) => m.user_id !== meId));
      } else {
        const { error } = await supabase.from("caucus_members").insert({ caucus_id: caucusId, user_id: meId, role: "member" });
        if (error) throw error;
        setMyRole("member");
        setMembers((prev) => [...prev, { user_id: meId, role: "member", profile: null }]);
      }
    } catch (e: any) {
      toast.error(e.message || "Could not update membership");
    }
  };

  const saveAbout = async () => {
    if (!caucus) return;
    try {
      const { error } = await supabase.from("caucuses").update({ description: aboutDraft }).eq("id", caucus.id);
      if (error) throw error;
      setCaucus({ ...caucus, description: aboutDraft });
      setEditingAbout(false);
      toast.success("Updated caucus description");
    } catch (e: any) {
      toast.error(e.message || "Could not update description");
    }
  };

  const postAnnouncement = async () => {
    if (!meId) return;
    if (!newAnnouncement.trim()) return;
    try {
      const { error } = await supabase.from("caucus_announcements").insert({
        caucus_id: caucusId,
        author_user_id: meId,
        title: "",
        body: newAnnouncement.trim(),
      });
      if (error) throw error;
      setNewAnnouncement("");
      toast.success("Posted");
    } catch (e: any) {
      toast.error(e.message || "Could not post announcement");
    }
  };

  const postComment = async () => {
    if (!meId) return;
    if (!selectedAnnouncementId) return;
    if (!newComment.trim()) return;
    try {
      const { error } = await supabase.from("caucus_comments").insert({
        announcement_id: selectedAnnouncementId,
        author_user_id: meId,
        body: newComment.trim(),
      });
      if (error) throw error;
      setNewComment("");
    } catch (e: any) {
      toast.error(e.message || "Could not post comment");
    }
  };

  if (loading || !caucus) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-6xl mx-auto px-4 py-10 text-gray-600">Loading...</main>
      </div>
    );
  }

  const visibleComments = selectedAnnouncementId ? commentsByAnnouncement[selectedAnnouncementId] ?? [] : [];
  const chair = members.find((m) => m.role === "chair")?.profile;
  const coChair = members.find((m) => m.role === "co_chair")?.profile;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{caucus.title}</h1>
              <p className="text-sm text-gray-600">
                Chair: {chair?.display_name ?? "—"} • Co-Chair: {coChair?.display_name ?? "—"} • {members.length} members
              </p>
            </div>
            <button
              onClick={joinLeave}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                myRole ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {myRole ? "Leave" : "Join"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">About</h2>
                {isLeader && !editingAbout && (
                  <button onClick={() => setEditingAbout(true)} className="text-blue-600 hover:text-blue-700 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
              {editingAbout ? (
                <div className="space-y-3">
                  <textarea
                    value={aboutDraft}
                    onChange={(e) => setAboutDraft(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void saveAbout()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingAbout(false);
                        setAboutDraft(caucus.description ?? "");
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-line">{caucus.description || "No description yet."}</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Announcement Board</h2>
              </div>

              {isLeader && (
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start gap-3">
                    <textarea
                      value={newAnnouncement}
                      onChange={(e) => setNewAnnouncement(e.target.value)}
                      placeholder="Post an announcement..."
                      rows={3}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button
                      onClick={() => void postAnnouncement()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                      disabled={!newAnnouncement.trim()}
                    >
                      <Send className="w-4 h-4" />
                      Post
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="border-r border-gray-200 max-h-[520px] overflow-y-auto">
                  {announcements.length === 0 ? (
                    <div className="p-6 text-sm text-gray-500">No announcements yet.</div>
                  ) : (
                    announcements.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAnnouncementId(a.id)}
                        className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 ${
                          selectedAnnouncementId === a.id ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="text-sm text-gray-900 font-medium line-clamp-2">{a.body}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {a.author?.display_name ?? "Unknown"} • {new Date(a.created_at).toLocaleString()}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="p-4 max-h-[520px] overflow-y-auto">
                  {selectedAnnouncement ? (
                    <div className="space-y-4">
                      <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                        <div className="text-sm text-gray-900 whitespace-pre-line">{selectedAnnouncement.body}</div>
                        <div className="text-xs text-gray-500 mt-2">
                          {selectedAnnouncement.author?.display_name ?? "Unknown"} •{" "}
                          {new Date(selectedAnnouncement.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900">Replies</h3>
                        {visibleComments.length === 0 ? (
                          <div className="text-sm text-gray-500">No replies yet.</div>
                        ) : (
                          visibleComments.map((c) => (
                            <div key={c.id} className="flex items-start gap-3">
                              {c.author?.avatar_url ? (
                                <img src={c.author.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <User className="w-4 h-4 text-blue-600" />
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="text-sm text-gray-900">
                                  <span className="font-medium">{c.author?.display_name ?? "Unknown"}</span>{" "}
                                  <span className="text-xs text-gray-500">
                                    • {new Date(c.created_at).toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-700 whitespace-pre-line">{c.body}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {myRole && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex items-start gap-2">
                            <textarea
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              rows={2}
                              placeholder="Write a reply..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                            <button
                              onClick={() => void postComment()}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                              disabled={!newComment.trim()}
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Select an announcement.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <UsersIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Members</h2>
            </div>
            <div className="space-y-3">
              {members
                .slice()
                .sort((a, b) => (a.role === b.role ? 0 : a.role === "chair" ? -1 : b.role === "chair" ? 1 : 0))
                .map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    {m.profile?.avatar_url ? (
                      <img src={m.profile.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{m.profile?.display_name ?? "Member"}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {m.profile?.constituency_name ?? "—"} • {m.profile?.party ?? "—"}
                      </div>
                    </div>
                    <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{m.role.replace("_", " ")}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

