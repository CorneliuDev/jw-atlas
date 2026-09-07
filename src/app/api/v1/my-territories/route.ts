// src/app/api/v1/my-territories/route.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/content/permissions";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentAppUser();
  const supabase = await createSupabaseServerClient();

  const { data: publicOnes } = await supabase.from("territories").select("id, name").eq("status", "approved").eq("visibility", "public");
  let ownOnes: { id: string; name: string }[] = [];
  if (user) {
    const { data } = await supabase.from("territories").select("id, name").eq("created_by", user.id);
    ownOnes = data ?? [];
  }
  const merged = [...(publicOnes ?? []), ...ownOnes];
  const deduped = Array.from(new Map(merged.map((t) => [t.id, t])).values());
  return NextResponse.json({ territories: deduped });
}