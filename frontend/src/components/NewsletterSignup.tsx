"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !email.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setSuccess(true);
        setEmail("");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--footer-link)" }}>
        Thanks for subscribing!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-[var(--space-2)]">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        style={{ background: "color-mix(in srgb, var(--footer-bg) 70%, white 8%)", border: "1px solid var(--footer-divider)", borderRadius: "var(--radius-md)", color: "var(--footer-heading)" }}
      />
      <button
        type="submit"
        disabled={submitting || !email.trim()}
        className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)" }}
      >
        {submitting ? "..." : "Subscribe"}
      </button>
      {error && <p className="text-[var(--text-xs)] sm:col-span-2" style={{ color: "var(--color-error)" }}>{error}</p>}
    </form>
  );
}
