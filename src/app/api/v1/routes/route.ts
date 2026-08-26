// src/app/api/v1/routes/route.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/v1/routes — returns approved routes with their waypoints,
// ordered by sequence_order, ready to render as a line on the map.
// Versioned per spec §9.3.
export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: routes, error: routesError } = await supabase
    .from("routes")
    .select("id, name, description")
    .eq("status", "approved");

  if (routesError) {
    return NextResponse.json({ error: routesError.message }, { status: 500 });
  }

  const routeIds = (routes ?? []).map((r) => r.id);

  const { data: waypoints, error: waypointsError } = await supabase
    .from("route_waypoints")
    .select("id, route_id, latitude, longitude, sequence_order, date_display, date_sort_value")
    .in("route_id", routeIds)
    .order("sequence_order", { ascending: true });

  if (waypointsError) {
    return NextResponse.json({ error: waypointsError.message }, { status: 500 });
  }

  const result = (routes ?? []).map((route) => ({
    ...route,
    waypoints: (waypoints ?? []).filter((w) => w.route_id === route.id),
  }));

  return NextResponse.json({ routes: result });
}