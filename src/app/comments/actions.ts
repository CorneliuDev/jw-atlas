"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAppUser } from "@/lib/content/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CommentableType =
	| "place"
	| "note"
	| "event"
	| "route"
	| "territory"
	| "person";

export async function addComment(
	contentType: CommentableType,
	contentId: string,
	body: string,
	parentCommentId: string | null,
	revalidatePathTarget: string,
) {
	const user = await getCurrentAppUser();
	if (!user) return { error: "Not logged in." };
	if (user.status !== "active") {
		return { error: "Silenced or banned accounts cannot comment." };
	}
	if (!body.trim()) return { error: "Comment cannot be empty." };

	const supabase = await createSupabaseServerClient();
	const { error } = await supabase.from("comments").insert({
		content_type: contentType,
		content_id: contentId,
		user_id: user.id,
		body: body.trim(),
		parent_comment_id: parentCommentId,
	});

	if (error) return { error: error.message };

	if (parentCommentId) {
		const { data: parent } = await supabase
			.from("comments")
			.select("user_id")
			.eq("id", parentCommentId)
			.single();

		if (parent && parent.user_id !== user.id) {
			await supabase.from("notifications").insert({
				user_id: parent.user_id,
				type: "comment_reply",
				message: "Someone replied to your comment.",
			});
		}
	}

	revalidatePath(revalidatePathTarget);
	return { success: true };
}

export async function deleteComment(
	commentId: string,
	revalidatePathTarget: string,
) {
	const user = await getCurrentAppUser();
	if (!user) return { error: "Not logged in." };

	const supabase = await createSupabaseServerClient();
	const { error } = await supabase.from("comments").delete().eq("id", commentId);

	if (error) return { error: error.message };

	revalidatePath(revalidatePathTarget);
	return { success: true };
}