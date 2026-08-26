"use server";

import { redirect } from "next/navigation";
import {
	canCreateContent,
	canModifyContent,
	getCurrentAppUser,
} from "@/lib/content/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updatePlace(placeId: string, formData: FormData) {
	const user = await getCurrentAppUser();
	const supabase = await createSupabaseServerClient();

	const { data: existing } = await supabase
		.from("places")
		.select("*")
		.eq("id", placeId)
		.single();
	if (!existing) return { error: "Place not found." };

	if (!canModifyContent(user, existing.created_by)) {
		return { error: "Not authorized to edit this place." };
	}

	const permission = canCreateContent(user);
	if (!permission.allowed) return { error: permission.reason ?? "Not allowed." };

	const updated = {
		name: formData.get("name") as string,
		description: formData.get("description") as string,
		latitude: parseFloat(formData.get("latitude") as string),
		longitude: parseFloat(formData.get("longitude") as string),
		status: permission.initialStatus,
	};

	if (
		!updated.name.trim() ||
		!Number.isFinite(updated.latitude) ||
		!Number.isFinite(updated.longitude)
	) {
		return { error: "Name and valid coordinates are required." };
	}

	const { error: updateError } = await supabase
		.from("places")
		.update(updated)
		.eq("id", placeId);
	if (updateError) return { error: updateError.message };

	const { error: versionError } = await supabase.from("content_versions").insert({
		content_type: "places",
		content_id: placeId,
		edited_by: user!.id,
		diff_snapshot: {
			before: {
				name: existing.name,
				description: existing.description,
				latitude: existing.latitude,
				longitude: existing.longitude,
			},
			after: updated,
		},
	});
	if (versionError) return { error: versionError.message };

	redirect(`/places/${placeId}?editStatus=${permission.initialStatus}`);
}