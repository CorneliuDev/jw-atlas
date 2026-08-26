import { addComment, deleteComment } from "@/app/comments/actions";
import { getCurrentAppUser } from "@/lib/content/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface CommentThreadProps {
	contentType: "place" | "note" | "event" | "route" | "territory" | "person";
	contentId: string;
	revalidatePathTarget: string;
}

interface CommentRow {
	id: string;
	body: string;
	user_id: string;
	parent_comment_id: string | null;
	created_at: string;
	users:
		| { display_name: string | null }
		| { display_name: string | null }[]
		| null;
}

function getDisplayName(users: CommentRow["users"]): string {
	if (!users) return "Unknown";
	if (Array.isArray(users)) return users[0]?.display_name ?? "Unknown";
	return users.display_name ?? "Unknown";
}

export default async function CommentThread({
	contentType,
	contentId,
	revalidatePathTarget,
}: CommentThreadProps) {
	const user = await getCurrentAppUser();
	const supabase = await createSupabaseServerClient();

	const { data: comments } = await supabase
		.from("comments")
		.select("id, body, user_id, parent_comment_id, created_at, users(display_name)")
		.eq("content_type", contentType)
		.eq("content_id", contentId)
		.order("created_at", { ascending: true });

	const rows = (comments ?? []) as unknown as CommentRow[];
	const topLevel = rows.filter((comment) => !comment.parent_comment_id);
	const repliesFor = (id: string) =>
		rows.filter((comment) => comment.parent_comment_id === id);

	function CommentNode({
		comment,
		depth,
	}: {
		comment: CommentRow;
		depth: number;
	}) {
		const canDelete =
			user && (user.id === comment.user_id || user.role === "admin");

		return (
			<div
				style={{
					marginLeft: depth * 20,
					marginTop: 10,
					borderLeft: depth > 0 ? "2px solid #eee" : "none",
					paddingLeft: depth > 0 ? 10 : 0,
				}}
			>
				<div style={{ fontSize: 12, color: "#888" }}>
					{getDisplayName(comment.users)} ·{" "}
					{new Date(comment.created_at).toLocaleDateString()}
				</div>
				<div>{comment.body}</div>
				{user && (
					<form
						action={async (formData: FormData) => {
							"use server";
							await addComment(
								contentType,
								contentId,
								formData.get("body") as string,
								comment.id,
								revalidatePathTarget,
							);
						}}
						style={{ marginTop: 4 }}
					>
						<input
							name="body"
							type="text"
							placeholder="Reply..."
							style={{ fontSize: 12, width: 200 }}
						/>
						<button type="submit" style={{ fontSize: 12 }}>
							Reply
						</button>
					</form>
				)}
				{canDelete && (
					<form
						action={async () => {
							"use server";
							await deleteComment(comment.id, revalidatePathTarget);
						}}
					>
						<button type="submit" style={{ fontSize: 11, color: "#993C1D" }}>
							Delete
						</button>
					</form>
				)}
				{repliesFor(comment.id).map((reply) => (
					<CommentNode key={reply.id} comment={reply} depth={depth + 1} />
				))}
			</div>
		);
	}

	return (
		<div
			style={{
				marginTop: "1.5rem",
				borderTop: "1px solid #eee",
				paddingTop: "1rem",
			}}
		>
			<h3>Comments</h3>
			{topLevel.length === 0 && (
				<p style={{ color: "#888" }}>No comments yet.</p>
			)}
			{topLevel.map((comment) => (
				<CommentNode key={comment.id} comment={comment} depth={0} />
			))}

			{user ? (
				<form
					action={async (formData: FormData) => {
						"use server";
						await addComment(
							contentType,
							contentId,
							formData.get("body") as string,
							null,
							revalidatePathTarget,
						);
					}}
					style={{ marginTop: "1rem" }}
				>
					<input
						name="body"
						type="text"
						placeholder="Add a comment..."
						style={{ width: "100%" }}
					/>
					<button type="submit">Post</button>
				</form>
			) : (
				<p style={{ color: "#888" }}>
					<a href="/login">Log in</a> to comment.
				</p>
			)}
		</div>
	);
}