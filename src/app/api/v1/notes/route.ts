// src/app/api/v1/notes/route.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/v1/notes — returns approved notes sorted chronologically, with
// linked place coordinates joined in (needed for map/timeline linkage,
// spec §6.4). Versioned per spec §9.3.
export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("notes")
    .select("id, title, body, date_display, date_sort_start, place_id, approximate, places(latitude, longitude, name)")
    .eq("status", "approved")
    .order("date_sort_start", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: data });
}