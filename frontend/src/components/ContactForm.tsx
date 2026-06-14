"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() }),
      });
      if (res.ok) {
        setSent(true);
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "form_submit",
          form_name: "contact",
          form_fields: { name: name.trim(), email: email.trim(), subject: subject.trim() },
        });
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
  };

  if (sent) {
    return (
      <div className="p-[var(--space-6)]" style={{ background: "var(--color-bg-subtle)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
        <p className="font-[family-name:var(--font-body)] text-[var(--text-base)]" style={{ color: "var(--color-text)" }}>
          Message sent! I&apos;ll get back to you soon.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-[var(--space-3)] font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer hover:text-[var(--color-accent)]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
      <div>
        <label htmlFor="contact-name" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Name *</label>
        <input id="contact-name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30" style={inputStyle} />
      </div>
      <div>
        <label htmlFor="contact-email" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Email *</label>
        <input id="contact-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30" style={inputStyle} />
      </div>
      <div>
        <label htmlFor="contact-subject" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Subject</label>
        <input id="contact-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30" style={inputStyle} />
      </div>
      <div>
        <label htmlFor="contact-message" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Message *</label>
        <textarea id="contact-message" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none resize-none focus:ring-2 focus:ring-[var(--color-accent)]/30" style={inputStyle} />
      </div>
      {error && <p className="text-[var(--text-sm)]" style={{ color: "var(--color-error)" }}>{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="self-start font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-6 py-2.5 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)" }}
      >
        {sending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
