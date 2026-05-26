"use client";

import { useState, useCallback, useEffect } from "react";
import { AuthProvider, useAuth, apiFetch } from "@/lib/auth";
import AdminSidebar from "@/components/admin/Sidebar";
import { UIProvider, useUI } from "@/components/admin/Toast";

function MediaContent() {
  const { token } = useAuth();
  const { toast, confirm } = useUI();
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const loadFiles = useCallback(async () => {
    try {
      const res = await apiFetch("/api/media");
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch { /* empty */ }
  }, []);

  useEffect(() => { if (token) loadFiles(); }, [token, loadFiles]);

  const uploadFiles = async (fileList: FileList | File[]) => {
    setUploading(true);
    setError("");
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append("image", file);
      try {
        const res = await apiFetch("/api/media/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error || `Upload failed for ${file.name}`);
          toast(`Upload failed: ${file.name}`, "error");
        }
      } catch (err) {
        setError(`Upload failed for ${file.name}`);
        toast(`Upload failed: ${file.name}`, "error");
        console.error(err);
      }
    }
    await loadFiles();
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = async (name: string) => {
    if (!(await confirm("Delete this file?"))) return;
    await apiFetch(`/api/media/${name}`, { method: "DELETE" });
    setFiles((prev) => prev.filter((f) => f.name !== name));
    toast("File deleted", "success");
  };

  const copyUrl = (url: string, name: string) => {
    const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(name);
    toast("URL copied to clipboard", "success");
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={() => { localStorage.removeItem("admin_token"); window.location.href = "/admin"; }} />
      <main className="flex-1 p-[var(--space-8)]">
        <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold mb-[var(--space-8)]" style={{ color: "var(--color-text)" }}>
          Media Library
        </h1>

        {error && (
          <div className="mb-[var(--space-4)] px-[var(--space-4)] py-[var(--space-2)] text-[var(--text-sm)]" style={{ background: "oklch(95% 0.05 25)", color: "oklch(40% 0.1 25)", borderRadius: "var(--radius-md)" }}>
            {error}
            <button onClick={() => setError("")} className="ml-[var(--space-3)] underline">Dismiss</button>
          </div>
        )}

        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="mb-[var(--space-8)] p-[var(--space-12)] text-center"
          style={{
            border: `2px dashed ${dragOver ? "var(--color-accent)" : "var(--color-border)"}`,
            borderRadius: "var(--radius-lg)",
            background: dragOver ? "var(--color-accent-lightest)" : "var(--color-bg-subtle)",
            transition: "all var(--duration-fast) var(--ease-out-quart)",
          }}
        >
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] mb-[var(--space-4)]" style={{ color: "var(--color-text-tertiary)" }}>
            {uploading ? "Uploading..." : "Drag and drop images here"}
          </p>
          <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider cursor-pointer px-[var(--space-4)] py-[var(--space-2)]" style={{ background: "var(--color-bg-muted)", borderRadius: "var(--radius-md)", color: "var(--color-text-secondary)" }}>
            Browse Files
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
          </label>
        </div>

        {/* File grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-[var(--space-4)]">
          {files.map((file) => (
            <div
              key={file.name}
              className="group relative cursor-pointer"
              style={{
                background: "var(--color-bg-subtle)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                aspectRatio: "1",
              }}
              onClick={() => copyUrl(file.url, file.name)}
              title="Click to copy URL"
            >
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${file.url}`}
                alt={file.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 font-[family-name:var(--font-mono)] text-[var(--text-xs)] text-white">
                  {copied === file.name ? "Copied!" : "Copy URL"}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(file.name); }}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-[var(--space-1)]"
                style={{ background: "oklch(99% 0 0 / 0.8)", color: "var(--color-error)", borderRadius: "var(--radius-sm)" }}
              >
                x
              </button>
            </div>
          ))}
        </div>

        {files.length === 0 && !uploading && (
          <p className="text-center py-[var(--space-8)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
            No files uploaded yet.
          </p>
        )}
      </main>
    </div>
  );
}

export default function MediaPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <MediaContent />
      </UIProvider>
    </AuthProvider>
  );
}
