"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { AuthProvider, logoutAdmin, useAuth } from "@/lib/auth";
import { adminApiRequest, getAdminErrorMessage, isAdminApiError } from "@/lib/admin-api";
import AdminSidebar from "@/components/admin/Sidebar";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface MediaFile {
  url: string;
  thumbnail?: string;
  name: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function MediaContent() {
  const { token } = useAuth();
  const { toast, confirm } = useUI();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    try {
      const data = await adminApiRequest<MediaFile[]>("/api/media");
      setFiles(data);
      setError(null);
    } catch (uploadError) {
      console.error(uploadError);
      setError("Failed to load media files. Please refresh and try again.");
      toast(getAdminErrorMessage(uploadError, "Failed to load media files."), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!token) return;

    const timeoutId = window.setTimeout(() => {
      void loadFiles();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [token, loadFiles]);

  const validateFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `${file.name}: only JPEG, PNG, WEBP, and GIF files are allowed.`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: file size must be 10MB or smaller.`;
    }

    return null;
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    if (uploading) return;

    const selectedFiles = Array.from(fileList);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadingCount(selectedFiles.length);
    setError(null);

    let successCount = 0;
    let firstFailure: string | null = null;

    for (const file of selectedFiles) {
      const validationMessage = validateFile(file);
      if (validationMessage) {
        if (!firstFailure) firstFailure = validationMessage;
        toast(validationMessage, "error");
        continue;
      }

      const formData = new FormData();
      formData.append("image", file);

      try {
        await adminApiRequest("/api/media/upload", {
          method: "POST",
          body: formData,
        });
        successCount += 1;
      } catch (uploadError) {
        console.error(uploadError);
        const message = `${file.name}: ${getAdminErrorMessage(uploadError, "Upload failed.")}`;
        if (!firstFailure) firstFailure = message;
        toast(message, "error");
      }
    }

    await loadFiles();
    setUploading(false);
    setUploadingCount(0);

    if (successCount > 0) {
      toast(
        successCount === selectedFiles.length
          ? `${successCount} file${successCount === 1 ? "" : "s"} uploaded successfully.`
          : `Uploaded ${successCount} file${successCount === 1 ? "" : "s"}. Some files failed.`,
        successCount === selectedFiles.length ? "success" : "info",
      );
    }

    if (firstFailure) {
      setError(firstFailure);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files.length) {
      void uploadFiles(event.dataTransfer.files);
    }
  };

  const handleDelete = async (name: string) => {
    if (deletingName) return;
    if (!(await confirm("Delete this file?"))) return;

    setDeletingName(name);
    try {
      await adminApiRequest(`/api/media/${name}`, { method: "DELETE" });
      await loadFiles();
      toast("File deleted", "success");
    } catch (deleteError) {
      console.error(deleteError);
      if (isAdminApiError(deleteError) && deleteError.status === 404) {
        await loadFiles();
        toast("File was already deleted.", "info");
      } else {
        const message = getAdminErrorMessage(deleteError, "Failed to delete file.");
        setError(message);
        toast(message, "error");
      }
    } finally {
      setDeletingName(null);
    }
  };

  const copyUrl = async (url: string, name: string) => {
    try {
      const fullUrl = `${API_URL}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(name);
      setError(null);
      toast("URL copied to clipboard", "success");
      window.setTimeout(() => setCopied(""), 2000);
    } catch (copyError) {
      console.error(copyError);
      const message = "Could not copy the media URL. Please try again.";
      setError(message);
      toast(message, "error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 w-full flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <div className="mb-[var(--space-8)] flex flex-col gap-[var(--space-2)]">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>
            Media Library
          </h1>
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
            Upload JPEG, PNG, WEBP, or GIF files up to 10MB each.
          </p>
        </div>

        {error ? (
          <div className="mb-[var(--space-4)] rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "oklch(95% 0.05 25)", color: "oklch(40% 0.1 25)" }}>
            {error}
            <button onClick={() => setError(null)} className="ml-[var(--space-3)] underline">Dismiss</button>
          </div>
        ) : null}

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="mb-[var(--space-8)] rounded-[var(--radius-lg)] p-[var(--space-6)] text-center sm:p-[var(--space-10)]"
          style={{
            border: `2px dashed ${dragOver ? "var(--color-accent)" : "var(--color-border)"}`,
            background: dragOver ? "var(--color-accent-lightest)" : "var(--color-bg-subtle)",
            transition: "all var(--duration-fast) var(--ease-out-quart)",
          }}
        >
          <p className="mb-[var(--space-3)] font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
            {uploading ? `Uploading ${uploadingCount} file${uploadingCount === 1 ? "" : "s"}...` : "Drag and drop images here"}
          </p>
          <p className="mb-[var(--space-4)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
            {uploading ? "Please wait until the current upload finishes." : "Uploads are optimized automatically after they finish."}
          </p>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider" style={{ background: "var(--color-bg-muted)", color: "var(--color-text-secondary)", opacity: uploading ? 0.6 : 1 }}>
            Browse Files
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              disabled={uploading}
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  void uploadFiles(event.target.files);
                  event.target.value = "";
                }
              }}
            />
          </label>
        </div>

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
            Loading...
          </p>
        ) : files.length === 0 && !uploading ? (
          <p className="py-[var(--space-8)] text-center text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
            No files uploaded yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-[var(--space-4)] sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {files.map((file) => (
              <div
                key={file.name}
                className="group relative overflow-hidden rounded-[var(--radius-md)]"
                style={{ background: "var(--color-bg-subtle)", aspectRatio: "1" }}
                role="button"
                tabIndex={0}
                onClick={() => void copyUrl(file.url, file.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void copyUrl(file.url, file.name);
                  }
                }}
              >
                <Image
                  src={`${API_URL}${file.thumbnail || file.url}`}
                  alt={file.name}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 16vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 z-10 bg-black/15 transition-colors group-hover:bg-black/35 md:bg-black/0">
                  <div className="flex h-full items-end justify-between gap-[var(--space-2)] p-[var(--space-2)]">
                    <span className="rounded-[var(--radius-sm)] bg-black/60 px-[var(--space-2)] py-[0.125rem] font-[family-name:var(--font-mono)] text-[var(--text-xs)] text-white opacity-100 md:opacity-0 md:group-hover:opacity-100">
                      {copied === file.name ? "Copied!" : "Copy URL"}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(file.name);
                      }}
                      disabled={deletingName === file.name}
                      className="pointer-events-auto rounded-[var(--radius-sm)] bg-white/90 px-[var(--space-2)] py-[0.125rem] font-[family-name:var(--font-mono)] text-[var(--text-xs)] text-[var(--color-error)] opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingName === file.name ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
