"use client";

import PostEditorContent from "@/components/admin/PostEditorContent";
import { UIProvider } from "@/components/admin/Toast";

export default function NewPostPage() {
  return (
    <UIProvider>
      <PostEditorContent />
    </UIProvider>
  );
}
