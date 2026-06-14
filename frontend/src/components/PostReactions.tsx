"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const EMOJIS = ["❤️", "👍", "🎯", "💡"] as const;

function getFingerprint() {
  return navigator.userAgent.length.toString(36) + screen.width.toString(36);
}

interface ReactionData {
  counts: Record<string, number>;
  userReactions: string[];
}

export default function PostReactions({ postId }: { postId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userReactions, setUserReactions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/reactions`);
      if (res.ok) {
        const data: ReactionData = await res.json();
        setCounts(data.counts || {});
        setUserReactions(data.userReactions || []);
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

  const handleReact = async (emoji: string) => {
    const fingerprint = getFingerprint();
    const isRemoving = userReactions.includes(emoji);

    setCounts((prev) => {
      const current = prev[emoji] || 0;
      return { ...prev, [emoji]: Math.max(0, current + (isRemoving ? -1 : 1)) };
    });
    setUserReactions((prev) => isRemoving ? prev.filter((e) => e !== emoji) : [...prev, emoji]);

    try {
      await fetch(`${API_URL}/api/posts/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, fingerprint }),
      });
    } catch {
      setCounts((prev) => {
        const current = prev[emoji] || 0;
        return { ...prev, [emoji]: Math.max(0, current + (isRemoving ? 1 : -1)) };
      });
      setUserReactions((prev) => isRemoving ? [...prev, emoji] : prev.filter((e) => e !== emoji));
    }
  };

  if (loading) return null;

  return (
    <div className="flex items-center gap-[var(--space-2)] flex-wrap">
      {EMOJIS.map((emoji) => {
        const active = userReactions.includes(emoji);
        const count = counts[emoji] || 0;
        return (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            className="inline-flex items-center gap-[var(--space-1)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-body)] text-[var(--text-sm)] cursor-pointer transition-all"
            style={{
              background: active ? "var(--color-accent-lightest)" : "var(--color-bg-subtle)",
              border: active ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
              borderRadius: "var(--radius-full)",
              color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
            }}
          >
            <span>{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
