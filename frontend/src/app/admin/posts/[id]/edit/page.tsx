"use client";

import { use } from "react";
import PostEditorContent from "@/components/admin/PostEditorContent";
import { UIProvider } from "@/components/admin/Toast";

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <UIProvider>
      <PostEditorContent postId={id} />
    </UIProvider>
  );
}
