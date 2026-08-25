// src/app/api/v1/territories/route.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/v1/territories?year=-1000
// Returns approved territories whose date range includes the given year,
// as GeoJSON, ready to feed directly into a MapLibre geojson source.
// Versioned per spec §9.3.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : null;

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("territories_geojson")
    .select("id, name, description, date_sort_start, date_sort_end, geometry_json")
    .eq("status", "approved");

  if (year !== null) {
    query = query
      .lte("date_sort_start", year)
      .or(`date_sort_end.gte.${year},date_sort_end.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const geojson = {
    type: "FeatureCollection",
    features: (data ?? []).map((t) => ({
      type: "Feature",
      id: t.id,
      properties: { name: t.name, description: t.description },
      geometry: JSON.parse(t.geometry_json),
    })),
  };

  return NextResponse.json(geojson);
}