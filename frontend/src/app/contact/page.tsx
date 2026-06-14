import type { Metadata } from "next";
import PageWrapper from "@/components/PageWrapper";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch.",
};

export default function ContactPage() {
  return (
    <PageWrapper>
      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-4)] md:px-[var(--space-8)] py-[var(--space-16)]">
        <div className="max-w-lg">
          <p
            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-4)]"
            style={{ color: "var(--color-accent)" }}
          >
            Contact
          </p>
          <h1
            className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-semibold mb-[var(--space-6)]"
            style={{ color: "var(--color-text)" }}
          >
            Get in Touch
          </h1>
          <p
            className="font-[family-name:var(--font-body)] text-[var(--text-base)] mb-[var(--space-8)]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Have a question, project idea, or just want to say hello? Fill out the form below and I&apos;ll get back to you.
          </p>
          <ContactForm />
        </div>
      </div>
    </PageWrapper>
  );
}
