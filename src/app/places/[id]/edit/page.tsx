import { getCurrentAppUser, canModifyContent } from "@/lib/content/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { updatePlace } from "@/app/places/edit-actions";

export default async function EditPlacePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const user = await getCurrentAppUser();
	const supabase = await createSupabaseServerClient();

	const { data: place } = await supabase
		.from("places")
		.select("*")
		.eq("id", id)
		.single();
	if (!place) notFound();
	if (!canModifyContent(user, place.created_by)) redirect(`/places/${id}`);

	const updatePlaceWithId = async (formData: FormData) => {
		"use server";
		await updatePlace(id, formData);
	};

	return (
		<main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 500 }}>
			<h1>Edit {place.name}</h1>
			<form
				action={updatePlaceWithId}
				style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
			>
				<label>
					Name
					<input
						name="name"
						type="text"
						defaultValue={place.name}
						required
						style={{ width: "100%" }}
					/>
				</label>
				<label>
					Latitude
					<input
						name="latitude"
						type="number"
						step="any"
						defaultValue={place.latitude}
						required
						style={{ width: "100%" }}
					/>
				</label>
				<label>
					Longitude
					<input
						name="longitude"
						type="number"
						step="any"
						defaultValue={place.longitude}
						required
						style={{ width: "100%" }}
					/>
				</label>
				<label>
					Description
					<textarea
						name="description"
						defaultValue={place.description ?? ""}
						style={{ width: "100%" }}
					/>
				</label>
				<button type="submit">Save changes</button>
			</form>
			<p>
				<a href={`/places/${id}`}>Cancel</a>
			</p>
		</main>
	);
}