"use client";

import Image from "next/image";
import { useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface LightboxProps {
  src: string;
  onClose: () => void;
}

export default function Lightbox({ src, onClose }: LightboxProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const fullSrc = src.startsWith("http") ? src : `${API_URL}${src}`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullSrc);
    } catch {
      // silent fail
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-[var(--space-4)]"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden rounded-[var(--radius-lg)]" style={{ maxHeight: "80vh", maxWidth: "90vw" }}>
          <Image
            src={fullSrc}
            alt="Preview"
            width={1200}
            height={800}
            unoptimized
            className="max-h-[80vh] w-auto object-contain"
            style={{ maxWidth: "90vw" }}
          />
        </div>
        <div className="mt-[var(--space-3)] flex items-center gap-[var(--space-3)]">
          <button
            onClick={() => void copyUrl()}
            className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 hover:brightness-110"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)" }}
          >
            Copy URL
          </button>
          <button
            onClick={onClose}
            className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-colors cursor-pointer"
            style={{ background: "rgba(255,255,255,0.15)", color: "white", borderRadius: "var(--radius-md)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
