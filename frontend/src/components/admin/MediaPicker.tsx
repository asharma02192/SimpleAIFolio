"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { adminApiRequest, getAdminErrorMessage } from "@/lib/admin-api";

interface MediaFile {
  url: string;
  thumbnail?: string;
  name: string;
}

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function MediaPicker({ open, onClose, onSelect }: MediaPickerProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApiRequest<MediaFile[]>("/api/media");
      setFiles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(null);
      void loadFiles();
    }
  }, [open, loadFiles]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const uploadFiles = async (fileList: FileList | File[]) => {
    if (uploading) return;
    const selectedFiles = Array.from(fileList);
    if (selectedFiles.length === 0) return;
    setUploading(true);
    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("image", file);
      try {
        await adminApiRequest("/api/media/upload", { method: "POST", body: formData });
      } catch (err) {
        console.error(err);
      }
    }
    await loadFiles();
    setUploading(false);
  };

  const handleSelect = () => {
    if (selected) {
      onSelect(selected);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-[var(--space-4)]"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-lg)]"
        style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-[var(--space-6)] py-[var(--space-4)]" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>Select Image</h2>
          <button onClick={onClose} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer" style={{ color: "var(--color-text-tertiary)" }}>Close</button>
        </div>

        <div className="flex-1 overflow-y-auto p-[var(--space-4)]">
          <label
            className="mb-[var(--space-4)] flex cursor-pointer items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2)] text-[var(--text-sm)] transition-colors"
            style={{ background: "var(--color-bg-muted)", color: "var(--color-text-secondary)", border: "1px dashed var(--color-border)" }}
          >
            {uploading ? "Uploading..." : "+ Upload new image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={uploading}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {loading ? (
            <p className="py-[var(--space-8)] text-center font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
          ) : files.length === 0 ? (
            <p className="py-[var(--space-8)] text-center text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No images uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-[var(--space-3)] sm:grid-cols-4 lg:grid-cols-5">
              {files.map((file) => (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => setSelected(file.url)}
                  className="relative overflow-hidden rounded-[var(--radius-md)] cursor-pointer"
                  style={{
                    aspectRatio: "1",
                    background: "var(--color-bg-subtle)",
                    outline: selected === file.url ? "3px solid var(--color-accent)" : "2px solid transparent",
                    outlineOffset: "-2px",
                  }}
                >
                  <Image
                    src={`${API_URL}${file.thumbnail || file.url}`}
                    alt={file.name}
                    fill
                    unoptimized
                    sizes="150px"
                    className="object-cover"
                  />
                  {selected === file.url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-[var(--space-6)] py-[var(--space-4)]" style={{ borderTop: "1px solid var(--color-border)" }}>
          {selected ? (
            <span className="truncate font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{selected}</span>
          ) : (
            <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>No image selected</span>
          )}
          <button
            onClick={handleSelect}
            disabled={!selected}
            className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
