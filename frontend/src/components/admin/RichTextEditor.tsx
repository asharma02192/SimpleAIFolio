"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useRef, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3201";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={isActive ? "is-active" : ""}
      title={title}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ content, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Underline,
      Placeholder.configure({ placeholder: "Write your post content here..." }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: { class: "tiptap" },
    },
  });

  // Keep ref in sync
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync external content changes (e.g. loading existing post)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    const ed = editorRef.current;
    if (!ed) return;

    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await apiFetch("/api/media/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Upload failed:", res.status, errData);
        return;
      }
      const data = await res.json();
      const src = data.url.startsWith("http") ? data.url : `${API_URL}${data.url}`;
      ed.chain().focus().setImage({ src }).run();
    } catch (err) {
      console.error("Image upload error:", err);
    }
  }, []);

  const addLink = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const url = window.prompt("Enter URL:");
    if (url) {
      ed.chain().focus().setLink({ href: url }).run();
    }
  }, []);

  if (!editor) return null;

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        background: "var(--color-bg-subtle)",
      }}
    >
      <div className="rte-toolbar">
        {/* Block types */}
        <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive("paragraph")} title="Paragraph">
          P
        </ToolbarButton>
        {[1, 2, 3, 4, 5, 6].map((level) => (
          <ToolbarButton
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run()}
            isActive={editor.isActive("heading", { level })}
            title={`Heading ${level}`}
          >
            H{level}
          </ToolbarButton>
        ))}

        <div className="rte-sep" />

        {/* Inline formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
          B
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
          I
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline">
          U
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
          S
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} title="Inline code">
          {"</>"}
        </ToolbarButton>

        <div className="rte-sep" />

        {/* Structure */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Blockquote">
          &ldquo;
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet list">
          &bull;
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Ordered list">
          1.
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          &mdash;
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Code block">
          {"{}"}
        </ToolbarButton>

        <div className="rte-sep" />

        {/* Insert */}
        <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Upload image">
          Img
        </ToolbarButton>
        <ToolbarButton onClick={addLink} isActive={editor.isActive("link")} title="Insert link">
          Link
        </ToolbarButton>

        <div className="rte-sep" />

        {/* History */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          &#x21A9;
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          &#x21AA;
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
