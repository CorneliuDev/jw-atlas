import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/v1/places — returns approved places for map rendering.
// Versioned per spec §9.3 so future breaking changes can ship as /v2
// without breaking this client.
export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("places")
    .select("id, name, latitude, longitude, confidence, description")
    .eq("status", "approved");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ places: data });
}