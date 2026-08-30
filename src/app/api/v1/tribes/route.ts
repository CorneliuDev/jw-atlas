import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/content/permissions";
import { NextResponse } from "next/server";

// Per the "Option B" decision: returns the user's own tribes (any
// visibility/status) plus everyone else's public+approved tribes, so a
// place can link to a tribe still in draft.
export async function GET() {
  const user = await getCurrentAppUser();
  const supabase = await createSupabaseServerClient();

  const { data: publicTribes } = await supabase
    .from("tribes")
    .select("id, name")
    .eq("status", "approved")
    .eq("visibility", "public");

  let ownTribes: { id: string; name: string }[] = [];
  if (user) {
    const { data } = await supabase.from("tribes").select("id, name").eq("created_by", user.id);
    ownTribes = data ?? [];
  }

  const merged = [...(publicTribes ?? []), ...ownTribes];
  const deduped = Array.from(new Map(merged.map((t) => [t.id, t])).values());

  return NextResponse.json({ tribes: deduped });
}
