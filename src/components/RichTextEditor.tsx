"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

interface RichTextEditorProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
    .replace(/<em>(.*?)<\/em>/g, "*$1*")
    .replace(/<li>(.*?)<\/li>/g, "- $1\n")
    .replace(/<\/?(ul|ol)>/g, "")
    .replace(/<p>(.*?)<\/p>/g, "$1\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .trim();
}

export default function RichTextEditor({ name, defaultValue = "", placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: defaultValue,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const hiddenInput = document.getElementById(`${name}-hidden`) as HTMLInputElement | null;
    const updateHidden = () => {
      if (hiddenInput) hiddenInput.value = htmlToMarkdown(editor.getHTML());
    };
    editor.on("update", updateHidden);
    updateHidden();
    return () => {
      editor.off("update", updateHidden);
    };
  }, [editor, name]);

  if (!editor) return null;

  return (
    <div className="border border-clay-200 rounded-md">
      <div className="flex gap-1 border-b border-clay-100 p-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 text-sm rounded ${editor.isActive("bold") ? "bg-clay-100" : ""}`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 text-sm italic rounded ${editor.isActive("italic") ? "bg-clay-100" : ""}`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 text-sm rounded ${editor.isActive("bulletList") ? "bg-clay-100" : ""}`}
        >
          • List
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-2 min-h-[100px] focus:outline-none"
        placeholder={placeholder}
      />
      <input type="hidden" id={`${name}-hidden`} name={name} defaultValue={defaultValue} />
    </div>
  );
}