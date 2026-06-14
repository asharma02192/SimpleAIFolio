"use client";

import { useState, useEffect, useCallback } from "react";

interface Comment {
  id: string;
  author: string;
  content: string;
  parentId: string | null;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CommentItem({ comment, onReply }: { comment: Comment; onReply: (id: string, author: string) => void }) {
  return (
    <div className="py-[var(--space-4)]" style={{ borderBottom: "1px solid var(--color-border)" }}>
      <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
        <span className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>{comment.author}</span>
        <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{formatDate(comment.createdAt)}</span>
      </div>
      <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)] whitespace-pre-wrap mb-[var(--space-2)]" style={{ color: "var(--color-text-secondary)" }}>{comment.content}</p>
      <button
        onClick={() => onReply(comment.id, comment.author)}
        className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-accent)]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Reply
      </button>
    </div>
  );
}

export default function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !name.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: name.trim(), content: message.trim(), parentId: replyTo?.id || null }),
      });
      if (res.ok) {
        setMessage("");
        setReplyTo(null);
        await load();
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const topLevel = comments.filter((c) => !c.parentId);
  const getReplies = (parentId: string) => comments.filter((c) => c.parentId === parentId);

  return (
    <div className="mt-[var(--space-12)] pt-[var(--space-8)]" style={{ borderTop: "1px solid var(--color-border)" }}>
      <h2 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold mb-[var(--space-6)]" style={{ color: "var(--color-text)" }}>
        Comments ({comments.length})
      </h2>

      <form onSubmit={handleSubmit} className="mb-[var(--space-8)] p-[var(--space-4)]" style={{ background: "var(--color-bg-subtle)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
        {replyTo && (
          <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-3)]">
            <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
              Replying to {replyTo.author}
            </span>
            <button type="button" onClick={() => setReplyTo(null)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer" style={{ color: "var(--color-accent)" }}>Cancel</button>
          </div>
        )}
        <div className="flex flex-col gap-[var(--space-3)]">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            maxLength={100}
            className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
            style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }}
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a comment..."
            required
            maxLength={2000}
            rows={3}
            className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none resize-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
            style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }}
          />
          <button
            type="submit"
            disabled={submitting || !name.trim() || !message.trim()}
            className="self-start font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)" }}
          >
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading comments...</p>
      ) : topLevel.length === 0 ? (
        <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No comments yet. Be the first to comment!</p>
      ) : (
        <div className="flex flex-col">
          {topLevel.map((comment) => (
            <div key={comment.id}>
              <CommentItem comment={comment} onReply={(id, author) => setReplyTo({ id, author })} />
              {getReplies(comment.id).map((reply) => (
                <div key={reply.id} className="ml-[var(--space-6)]" style={{ borderLeft: "2px solid var(--color-border)" }}>
                  <CommentItem comment={reply} onReply={(id, author) => setReplyTo({ id, author })} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
