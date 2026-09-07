// src/app/routes/actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canCreateContent } from "@/lib/content/permissions";

interface WaypointInput {
  lat: number;
  lng: number;
  dateDisplay: string;
  dateSortValue: number | null;
}

export async function createRoute(
  name: string,
  description: string,
  waypoints: WaypointInput[],
  extra?: {
    scriptureReference?: string;
    dateSortStart?: number | null;
    dateSortEnd?: number | null;
    personIds?: string[];
    publish?: boolean;
  }
) {
  const user = await getCurrentAppUser();
  const permission = canCreateContent(user);

  if (!permission.allowed) {
    return { error: permission.reason ?? "Not allowed." };
  }

  if (!name || waypoints.length < 2) {
    return { error: "A route needs a name and at least 2 waypoints." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: route, error: routeError } = await supabase
    .from("routes")
    .insert({
      name,
      description: description || null,
      scripture_reference: extra?.scriptureReference || null,
      date_sort_start: extra?.dateSortStart ?? null,
      date_sort_end: extra?.dateSortEnd ?? null,
      status: permission.initialStatus,
      visibility: extra?.publish ? "public" : "private",
      created_by: user!.id,
    })
    .select("id")
    .single();

  if (routeError || !route) {
    return { error: routeError?.message ?? "Failed to create route." };
  }

  const waypointRows = waypoints.map((wp, index) => ({
    route_id: route.id,
    latitude: wp.lat,
    longitude: wp.lng,
    sequence_order: index + 1,
    date_display: wp.dateDisplay || null,
    date_sort_value: wp.dateSortValue,
  }));

  const { error: waypointsError } = await supabase
    .from("route_waypoints")
    .insert(waypointRows);

  if (waypointsError) {
    return { error: waypointsError.message };
  }

  if ((extra?.personIds ?? []).length > 0) {
    await supabase.from("person_routes").insert(
      (extra?.personIds ?? []).map((personId) => ({ person_id: personId, route_id: route.id }))
    );
  }

  return { success: true, status: permission.initialStatus, published: !!extra?.publish };
}