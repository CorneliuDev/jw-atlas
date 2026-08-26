import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/v1/periods — returns approved reference-layer eras.
export async function GET() {
	const supabase = await createSupabaseServerClient();

	const { data, error } = await supabase
		.from("periods")
		.select("id, title, description, date_sort_start, date_sort_end")
		.eq("status", "approved")
		.eq("is_reference_layer", true)
		.order("date_sort_start", { ascending: true });

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json({ periods: data ?? [] });
}
