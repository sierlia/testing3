import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Reply, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { ReactionEmoji, ReactionsBar, ReactionsSummary } from "./ReactionsBar";
import { DefaultAvatar } from "./DefaultAvatar";

export type ProfileLite = {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
};

export type ThreadComment = {
  id: string;
  announcement_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
  parent_comment_id?: string | null;
  author: ProfileLite | null;
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ThreadedComments({
  comments,
  meId,
  reactionsByCommentId,
  onToggleReaction,
  onSubmitComment,
  canDeleteComments = false,
  onDeleteComment,
}: {
  comments: ThreadComment[];
  meId: string | null;
  reactionsByCommentId: Record<string, ReactionsSummary | undefined>;
  onToggleReaction: (commentId: string, emoji: ReactionEmoji) => void | Promise<void>;
  onSubmitComment: (body: string, parentCommentId: string | null) => Promise<void>;
  canDeleteComments?: boolean;
  onDeleteComment?: (commentId: string) => Promise<void>;
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { roots, childrenByParent, byId } = useMemo(() => {
    const byParent: Record<string, ThreadComment[]> = {};
    const rootList: ThreadComment[] = [];
    const idMap = new Map<string, ThreadComment>();
    for (const c of comments) idMap.set(c.id, c);
    for (const c of comments) {
      const parent = c.parent_comment_id ?? null;
      if (!parent) rootList.push(c);
      else byParent[parent] = [...(byParent[parent] ?? []), c];
    }
    return { roots: rootList, childrenByParent: byParent, byId: idMap };
  }, [comments]);

  const renderNode = (comment: ThreadComment, depth: number) => {
    const children = childrenByParent[comment.id] ?? [];
    const isCollapsed = collapsed[comment.id] ?? false;
    const draft = replyDrafts[comment.id] ?? "";
    const canReply = !!meId;

    const parent = comment.parent_comment_id ? byId.get(comment.parent_comment_id) ?? null : null;
    const parentName = parent ? parent.author?.display_name ?? "Member" : null;

    return (
      <div key={comment.id} className="space-y-2">
        <div
          className="flex gap-3"
          style={{
            paddingLeft: depth > 0 ? depth * 16 : 0,
            borderLeft: depth > 0 ? "1px solid rgb(229 231 235)" : undefined,
          }}
        >
          {comment.author?.avatar_url ? (
            <img
              src={comment.author.avatar_url}
              alt={comment.author.display_name ?? "Member"}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <DefaultAvatar className="w-8 h-8 flex-shrink-0" iconClassName="w-4 h-4 text-gray-500" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <Link to={`/profile/${comment.author_user_id}`} className={`font-semibold hover:underline ${comment.author?.role === "teacher" ? "text-green-700" : "text-gray-900"}`}>
                  {comment.author?.display_name ?? "Member"}{comment.author?.role === "teacher" ? " (Teacher)" : ""}
                </Link>
                <span className="text-gray-500 text-xs ml-2">{formatDate(comment.created_at)}</span>
              </div>
              {canDeleteComments && onDeleteComment && (
                <button
                  type="button"
                  onClick={() => void onDeleteComment(comment.id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap mt-1">
              {parentName ? <span className="text-blue-600 font-medium">@{parentName} </span> : null}
              {comment.body}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <ReactionsBar summary={reactionsByCommentId[comment.id]} onToggle={(e) => onToggleReaction(comment.id, e)} canReact={!!meId} />
              <button
                type="button"
                disabled={!canReply}
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Reply className="w-3.5 h-3.5" />
                Reply
              </button>
              {children.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCollapsed((p) => ({ ...p, [comment.id]: !isCollapsed }))}
                  className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {isCollapsed ? `Show replies (${children.length})` : "Hide replies"}
                </button>
              )}
            </div>

            {replyingTo === comment.id && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setReplyDrafts((p) => ({ ...p, [comment.id]: e.target.value }))}
                  rows={3}
                  placeholder="Write a reply…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const body = draft.trim();
                      if (!body) return;
                      await onSubmitComment(body, comment.id);
                      setReplyDrafts((p) => ({ ...p, [comment.id]: "" }));
                      setReplyingTo(null);
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="px-3 py-1.5 text-gray-700 hover:text-gray-900 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isCollapsed && children.length > 0 && (
          <div className="space-y-3">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!roots.length) {
    return <div className="text-sm text-gray-500">No comments yet</div>;
  }

  return <div className="space-y-4">{roots.map((c) => renderNode(c, 0))}</div>;
}
