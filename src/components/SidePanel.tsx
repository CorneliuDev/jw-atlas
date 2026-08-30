// src/components/SidePanel.tsx
"use client";

interface SidePanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function SidePanel({ title, onClose, children }: SidePanelProps) {
  return (
    <div className="absolute top-16 right-0 w-[360px] h-[calc(100%-4rem)] bg-white shadow-[-2px_0_8px_rgba(0,0,0,0.15)] overflow-y-auto font-sans z-10">
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-clay-100">
        <h2 className="text-lg font-semibold text-clay-900 m-0">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="text-clay-600 hover:text-clay-900 text-xl leading-none"
        >
          ×
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}