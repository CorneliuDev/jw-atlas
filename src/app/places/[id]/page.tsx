import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CommentThread from "@/components/CommentThread";
import { canModifyContent, getCurrentAppUser } from "@/lib/content/permissions";

export default async function PlaceSharePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const supabase = await createSupabaseServerClient();

	const { data: place } = await supabase
		.from("places")
		.select("id, name, latitude, longitude, description, confidence, created_by")
		.eq("id", id)
		.eq("status", "approved")
		.single();

	if (!place) notFound();

	const user = await getCurrentAppUser();
	const canEdit = canModifyContent(user, place.created_by);

	return (
		<main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 500 }}>
			<h1>{place.name}</h1>
			<p style={{ color: "#666" }}>Confidence: {place.confidence}</p>
			{place.description && <p>{place.description}</p>}
			<a href={`/?focusPlace=${place.id}`}>View on map</a>
			{canEdit && (
				<p>
					<a href={`/places/${place.id}/edit`}>Edit this place</a>
				</p>
			)}
			<CommentThread
				contentType="place"
				contentId={place.id}
				revalidatePathTarget={`/places/${place.id}`}
			/>
		</main>
	);
}