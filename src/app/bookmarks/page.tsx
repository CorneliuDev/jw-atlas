import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/content/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { removeBookmark } from "./actions";

const TABLE_BY_TYPE: Record<string, string> = {
	place: "places",
	note: "notes",
	route: "routes",
	territory: "territories",
	person: "people",
};

export default async function BookmarksPage() {
	const user = await getCurrentAppUser();
	if (!user) redirect("/login");

	const supabase = await createSupabaseServerClient();
	const { data: bookmarks } = await supabase
		.from("bookmarks")
		.select("id, content_type, content_id, collection_name, created_at")
		.eq("user_id", user.id)
		.order("collection_name")
		.order("created_at", { ascending: false });

	const resolved = await Promise.all(
		(bookmarks ?? []).map(async (bookmark) => {
			const table = TABLE_BY_TYPE[bookmark.content_type];
			if (!table) return { ...bookmark, name: "(unknown)" };

			const { data } = await supabase
				.from(table)
				.select("name")
				.eq("id", bookmark.content_id)
				.single();
			return { ...bookmark, name: data?.name ?? "(deleted)" };
		}),
	);

	const grouped = resolved.reduce<Record<string, typeof resolved>>((groups, bookmark) => {
		(groups[bookmark.collection_name] ??= []).push(bookmark);
		return groups;
	}, {});

	return (
		<main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 600 }}>
			<h1>My study trails</h1>
			<p>
				<Link href="/">Back to map</Link>
			</p>

			{Object.keys(grouped).length === 0 && (
				<p style={{ color: "#888" }}>No bookmarks yet.</p>
			)}

			{Object.entries(grouped).map(([collectionName, items]) => (
				<div key={collectionName} style={{ marginBottom: "1.5rem" }}>
					<h2>{collectionName}</h2>
					<ul>
						{items.map((item) => (
							<li key={item.id}>
								[{item.content_type}] {item.name}{" "}
								<form
									action={async () => {
									"use server";
									await removeBookmark(item.id);
								}}
								style={{ display: "inline" }}
								>
									<button type="submit" style={{ fontSize: 11 }}>
										Remove
									</button>
								</form>
							</li>
						))}
					</ul>
				</div>
			))}
		</main>
	);
}