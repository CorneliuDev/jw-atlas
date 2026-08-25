"use client";

interface NotePlace {
  latitude: number;
  longitude: number;
  name: string;
}

export interface TimelineNote {
  id: string;
  title: string;
  body: string;
  date_display: string | null;
  date_sort_start: number | null;
  place_id: string | null;
  approximate: boolean;
  places: NotePlace | null;
}

interface TimelineProps {
  notes: TimelineNote[];
  loading: boolean;
  selectedNoteId: string | null;
  onSelectNote: (note: TimelineNote) => void;
}

export default function Timeline({ notes, loading, selectedNoteId, onSelectNote }: TimelineProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: 160,
        background: "white",
        borderTop: "1px solid #ddd",
        overflowX: "auto",
        overflowY: "hidden",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0.75rem 1rem",
        fontFamily: "sans-serif",
      }}
    >
      {loading && <span style={{ color: "#888" }}>Loading timeline...</span>}
      {!loading && notes.length === 0 && (
        <span style={{ color: "#888" }}>No approved notes yet.</span>
      )}
      {notes.map((note) => {
        const isSelected = note.id === selectedNoteId;
        return (
          <button
            key={note.id}
            id={`timeline-note-${note.id}`}
            onClick={() => onSelectNote(note)}
            style={{
              flexShrink: 0,
              border: isSelected ? "2px solid #0F6E56" : "1px solid #ccc",
              borderRadius: 6,
              padding: "0.5rem 0.75rem",
              background: isSelected ? "#E1F5EE" : "white",
              cursor: "pointer",
              textAlign: "left",
              minWidth: 140,
            }}
          >
            <div style={{ fontSize: 12, color: "#666" }}>
              {note.date_display ?? "Undated"}
              {note.approximate && " (approx.)"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{note.title}</div>
          </button>
        );
      })}
    </div>
  );
}