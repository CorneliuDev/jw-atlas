"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAppUser } from "@/lib/content/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BookmarkableType =
	| "place"
	| "note"
	| "event"
	| "route"
	| "territory"
	| "person";

export async function addBookmark(
	contentType: BookmarkableType,
	contentId: string,
	collectionName = "My study trail",
) {
	const user = await getCurrentAppUser();
	if (!user) return { error: "Not logged in." };
	if (user.status !== "active") {
		return { error: "Account cannot create bookmarks." };
	}

	const supabase = await createSupabaseServerClient();
	const { error } = await supabase.from("bookmarks").insert({
		user_id: user.id,
		content_type: contentType,
		content_id: contentId,
		collection_name: collectionName,
	});

	if (error) {
		if (error.code === "23505") {
			return { error: "Already bookmarked in this collection." };
		}
		return { error: error.message };
	}

	revalidatePath("/bookmarks");
	return { success: true };
}

export async function addPlaceBookmark(
	contentId: string,
	_formData: FormData,
): Promise<void> {
	void _formData;
	await addBookmark("place", contentId);
}

export async function removeBookmark(bookmarkId: string) {
	const user = await getCurrentAppUser();
	if (!user) return { error: "Not logged in." };

	const supabase = await createSupabaseServerClient();
	const { error } = await supabase
		.from("bookmarks")
		.delete()
		.eq("id", bookmarkId)
		.eq("user_id", user.id);

	if (error) return { error: error.message };

	revalidatePath("/bookmarks");
	return { success: true };
}