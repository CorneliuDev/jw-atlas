// src/app/api/v1/routes/[id]/route.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("routes")
    .select("id, name, description, scripture_reference, date_sort_start, date_sort_end, created_by, status, visibility")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: waypoints, error: waypointsError } = await supabase
    .from("route_waypoints")
    .select("id, route_id, latitude, longitude, sequence_order, date_display, date_sort_value")
    .eq("route_id", id)
    .order("sequence_order", { ascending: true });

  if (waypointsError) {
    return NextResponse.json({ error: waypointsError.message }, { status: 500 });
  }

  return NextResponse.json({ route: { ...data, waypoints: waypoints ?? [] } });
}
