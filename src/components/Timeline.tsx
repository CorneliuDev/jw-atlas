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
    <div className="absolute bottom-0 left-0 right-0 max-h-40 bg-white border-t border-gray-300 overflow-x-auto overflow-y-hidden flex items-center gap-3 px-4 py-3 font-sans">
      {loading && <span className="text-gray-500">Loading timeline...</span>}
      {!loading && notes.length === 0 && (
        <span className="text-gray-500">No approved notes yet.</span>
      )}
      {notes.map((note) => {
        const isSelected = note.id === selectedNoteId;
        return (
          <button
            key={note.id}
            id={`timeline-note-${note.id}`}
            onClick={() => onSelectNote(note)}
            className={[
              "shrink-0 rounded-md px-3 py-2 text-left min-w-[140px] cursor-pointer",
              isSelected ? "border-2 border-[#0F6E56] bg-[#E1F5EE]" : "border border-gray-300 bg-white",
            ].join(" ")}
          >
            <div className="text-[12px] text-gray-600">
              {note.date_display ?? "Undated"}
              {note.approximate && " (approx.)"}
            </div>
            <div className="text-[14px] font-medium">{note.title}</div>
          </button>
        );
      })}
    </div>
  );
}