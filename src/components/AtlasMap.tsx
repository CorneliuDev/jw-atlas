"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as turf from "@turf/turf";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Timeline, { TimelineNote } from "./Timeline";
import { addPlaceBookmark } from "@/app/bookmarks/actions";
import { createTerritory } from "@/app/territories/actions";
import { createRoute } from "@/app/routes/actions";

const ESRI_HILLSHADE_URL =
	"https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";
const ESRI_TERRAIN_BASE_URL =
	"https://services.arcgisonline.com/arcgis/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}";

interface Place {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	confidence: string;
	description: string | null;
}

export default function AtlasMap() {
	const searchParams = useSearchParams();
	const focusPlaceId = searchParams.get("focusPlace");
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<maplibregl.Map | null>(null);
	const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

	const [clickedCoords, setClickedCoords] = useState<{
		lat: number;
		lng: number;
	} | null>(null);
	const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

	const [notes, setNotes] = useState<TimelineNote[]>([]);
	const [notesLoading, setNotesLoading] = useState(true);
	const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

	const [territoryYear, setTerritoryYear] = useState<number>(-1000);

	const [drawMode, setDrawMode] = useState(false);
	const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);
	const [showTerritoryForm, setShowTerritoryForm] = useState(false);
	const [territoryFormMessage, setTerritoryFormMessage] = useState<
		string | null
	>(null);
	const [routeDrawMode, setRouteDrawMode] = useState(false);
	const [routeWaypoints, setRouteWaypoints] = useState<
		{ lat: number; lng: number; dateDisplay: string; dateSortValue: string }[]
	>([]);
	const [showRouteForm, setShowRouteForm] = useState(false);
	const [routeFormMessage, setRouteFormMessage] = useState<string | null>(null);
	const [measureMode, setMeasureMode] = useState(false);
	const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
	const [measureDistance, setMeasureDistance] = useState<string | null>(null);
	const [measureAreaMode, setMeasureAreaMode] = useState(false);
	const [measureAreaPoints, setMeasureAreaPoints] = useState<[number, number][]>(
		[],
	);
	const [measureArea, setMeasureArea] = useState<string | null>(null);

	function highlightMarker(placeId: string | null) {
		markersRef.current.forEach((marker, id) => {
			const el = marker.getElement();
			el.style.outline = id === placeId ? "3px solid #D85A30" : "none";
			el.style.outlineOffset = "2px";
		});
	}

	async function loadPlaces() {
          const res = await fetch("/api/v1/places");
          const body = (await res.json()) as { places?: Place[]; error?: string };
          const places = body.places ?? [];

          markersRef.current.forEach((m) => m.remove());
          markersRef.current = new Map();

          places.forEach((place) => {
			const el = document.createElement("div");
			el.style.width = "16px";
			el.style.height = "16px";
			el.style.borderRadius = "50%";
			el.style.cursor = "pointer";
			if (place.confidence === "confirmed") {
				el.style.background = "#0F6E56";
				el.style.border = "2px solid #0F6E56";
			} else if (place.confidence === "disputed") {
				el.style.background = "transparent";
				el.style.border = "2px dashed #993C1D";
			} else {
				el.style.background = "transparent";
				el.style.border = "2px solid #0F6E56";
			}

			el.addEventListener("click", (e) => {
				e.stopPropagation();
				if (drawMode || measureMode || measureAreaMode) return;
				setClickedCoords(null);
				setSelectedPlace(place);

				const relatedNote = notes.find((n) => n.place_id === place.id);
				if (relatedNote) {
					setSelectedNoteId(relatedNote.id);
					document
						.getElementById(`timeline-note-${relatedNote.id}`)
						?.scrollIntoView({
							behavior: "smooth",
							inline: "center",
						});
				}
				highlightMarker(place.id);
			});

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([place.longitude, place.latitude])
				.addTo(mapRef.current!);

			markersRef.current.set(place.id, marker);
		});

		if (focusPlaceId) {
			const focusPlace = places.find((p) => p.id === focusPlaceId);
			if (focusPlace) {
				mapRef.current?.flyTo({
					center: [focusPlace.longitude, focusPlace.latitude],
					zoom: 9,
					duration: 1000,
				});
				setSelectedPlace(focusPlace);
				highlightMarker(focusPlace.id);
			}
		}
	}

	async function loadNotes() {
		const res = await fetch("/api/v1/notes");
		const data = await res.json();
		setNotes(data.notes ?? []);
		setNotesLoading(false);
	}

	async function loadTerritories(year: number) {
		if (!mapRef.current) return;
		const res = await fetch(`/api/v1/territories?year=${year}`);
		const geojson = await res.json();

		const source = mapRef.current.getSource("territories") as
			| maplibregl.GeoJSONSource
			| undefined;
		if (source) {
			source.setData(geojson);
		}
	}

	async function loadRoutes() {
		if (!mapRef.current) return;
		const res = await fetch("/api/v1/routes");
		const { routes } = await res.json();

		const features: GeoJSON.Feature[] = [];

		(routes ?? []).forEach(
			(route: {
				id: string;
				name: string;
				description: string | null;
				waypoints: {
					latitude: number;
					longitude: number;
					date_display: string | null;
				}[];
			}) => {
				if (route.waypoints.length < 2) return;

				features.push({
					type: "Feature",
					properties: {
						name: route.name,
						description: route.description,
						kind: "line",
					},
					geometry: {
						type: "LineString",
						coordinates: route.waypoints.map((w) => [w.longitude, w.latitude]),
					},
				});

				route.waypoints.forEach((w) => {
					features.push({
						type: "Feature",
						properties: {
							name: route.name,
							dateDisplay: w.date_display,
							kind: "waypoint",
						},
						geometry: { type: "Point", coordinates: [w.longitude, w.latitude] },
					});
				});
			},
		);

		const source = mapRef.current.getSource("routes") as
			| maplibregl.GeoJSONSource
			| undefined;
		if (source) source.setData({ type: "FeatureCollection", features });
	}

	function updateDrawPreview(points: [number, number][]) {
		const source = mapRef.current?.getSource("draw-preview") as
			| maplibregl.GeoJSONSource
			| undefined;
		if (!source) return;

		const features: GeoJSON.Feature[] = [];

		points.forEach((p) => {
			features.push({
				type: "Feature",
				properties: {},
				geometry: { type: "Point", coordinates: p },
			});
		});

		if (points.length > 1) {
			features.push({
				type: "Feature",
				properties: {},
				geometry: { type: "LineString", coordinates: points },
			});
		}

		if (points.length > 2) {
			features.push({
				type: "Feature",
				properties: {},
				geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
			});
		}

		source.setData({ type: "FeatureCollection", features });
	}

	function updateRouteDrawPreview(points: { lat: number; lng: number }[]) {
		const source = mapRef.current?.getSource("route-draw-preview") as
			| maplibregl.GeoJSONSource
			| undefined;
		if (!source) return;

		const coords = points.map((p) => [p.lng, p.lat]);
		const features: GeoJSON.Feature[] = coords.map((coordinates) => ({
			type: "Feature",
			properties: {},
			geometry: { type: "Point", coordinates },
		}));

		if (coords.length > 1) {
			features.push({
				type: "Feature",
				properties: {},
				geometry: { type: "LineString", coordinates: coords },
			});
		}

		source.setData({ type: "FeatureCollection", features });
	}

	function updateMeasurePreview(points: [number, number][]) {
		const source = mapRef.current?.getSource("measure-preview") as
			| maplibregl.GeoJSONSource
			| undefined;
		if (!source) return;

		const features: GeoJSON.Feature[] = points.map((p) => ({
			type: "Feature",
			properties: {},
			geometry: { type: "Point", coordinates: p },
		}));

		if (points.length === 2) {
			features.push({
				type: "Feature",
				properties: {},
				geometry: { type: "LineString", coordinates: points },
			});
		}

		source.setData({ type: "FeatureCollection", features });
	}

	function updateMeasureAreaPreview(points: [number, number][]) {
		const source = mapRef.current?.getSource("measure-area-preview") as
			| maplibregl.GeoJSONSource
			| undefined;
		if (!source) return;

		const features: GeoJSON.Feature[] = points.map((p) => ({
			type: "Feature",
			properties: {},
			geometry: { type: "Point", coordinates: p },
		}));

		if (points.length > 1) {
			features.push({
				type: "Feature",
				properties: {},
				geometry: { type: "LineString", coordinates: points },
			});
		}

		if (points.length > 2) {
			features.push({
				type: "Feature",
				properties: {},
				geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
			});
		}

		source.setData({ type: "FeatureCollection", features });
	}

	function handleSelectNote(note: TimelineNote) {
		setSelectedNoteId(note.id);
		if (note.places && mapRef.current) {
			mapRef.current.flyTo({
				center: [note.places.longitude, note.places.latitude],
				zoom: 8,
				duration: 800,
			});
			if (note.place_id) highlightMarker(note.place_id);
		}
	}

	function startDrawing() {
		setDrawMode(true);
		setDrawnPoints([]);
		setClickedCoords(null);
		setSelectedPlace(null);
		updateDrawPreview([]);
	}

	function cancelDrawing() {
		setDrawMode(false);
		setDrawnPoints([]);
		setShowTerritoryForm(false);
		updateDrawPreview([]);
	}

	function startRouteDrawing() {
		setRouteDrawMode(true);
		setRouteWaypoints([]);
		setRouteFormMessage(null);
		setClickedCoords(null);
		setSelectedPlace(null);
		updateRouteDrawPreview([]);
	}

	function cancelRouteDrawing() {
		setRouteDrawMode(false);
		setRouteWaypoints([]);
		setShowRouteForm(false);
		updateRouteDrawPreview([]);
	}

	function startMeasuring() {
		setMeasureMode(true);
		setMeasurePoints([]);
		setMeasureDistance(null);
		setClickedCoords(null);
		setSelectedPlace(null);
		updateMeasurePreview([]);
	}

	function cancelMeasuring() {
		setMeasureMode(false);
		setMeasurePoints([]);
		setMeasureDistance(null);
		updateMeasurePreview([]);
	}

	function startMeasuringArea() {
		setMeasureAreaMode(true);
		setMeasureAreaPoints([]);
		setMeasureArea(null);
		setClickedCoords(null);
		setSelectedPlace(null);
		updateMeasureAreaPreview([]);
	}

	function cancelMeasuringArea() {
		setMeasureAreaMode(false);
		setMeasureAreaPoints([]);
		setMeasureArea(null);
		updateMeasureAreaPreview([]);
	}

	function finishRouteDrawing() {
		if (routeWaypoints.length < 2) {
			setRouteFormMessage("A route needs at least 2 waypoints.");
			return;
		}
		setShowRouteForm(true);
	}

	async function handleRouteSubmit(formData: FormData) {
		const name = formData.get("name") as string;
		const description = formData.get("description") as string;
		const waypointsForSubmit = routeWaypoints.map((wp) => ({
			lat: wp.lat,
			lng: wp.lng,
			dateDisplay: wp.dateDisplay,
			dateSortValue: wp.dateSortValue ? parseInt(wp.dateSortValue, 10) : null,
		}));

		const result = await createRoute(name, description, waypointsForSubmit);
		if (result.error) {
			setRouteFormMessage(result.error);
			return;
		}

		setRouteFormMessage(`Route submitted! Status: ${result.status}`);
		setRouteWaypoints([]);
		updateRouteDrawPreview([]);
		setShowRouteForm(false);
		setRouteDrawMode(false);
		loadRoutes();
	}

	function updateWaypointField(
		index: number,
		field: "dateDisplay" | "dateSortValue",
		value: string,
	) {
		setRouteWaypoints((prev) =>
			prev.map((wp, i) => (i === index ? { ...wp, [field]: value } : wp)),
		);
	}

	function finishDrawing() {
		if (drawnPoints.length < 3) {
			setTerritoryFormMessage("A territory needs at least 3 points.");
			return;
		}
		setShowTerritoryForm(true);
	}

	async function handleTerritorySubmit(formData: FormData) {
		const geometry = {
			type: "Polygon",
			coordinates: [[...drawnPoints, drawnPoints[0]]],
		};
		formData.set("geometry", JSON.stringify(geometry));

		const result = await createTerritory(formData);

		if (result.error) {
			setTerritoryFormMessage(result.error);
			return;
		}

		setTerritoryFormMessage(`Territory submitted! Status: ${result.status}`);
		setDrawnPoints([]);
		updateDrawPreview([]);
		setShowTerritoryForm(false);
		setDrawMode(false);
		loadTerritories(territoryYear);
	}

	useEffect(() => {
		if (!mapContainerRef.current || mapRef.current) return;

		mapRef.current = new maplibregl.Map({
			container: mapContainerRef.current,
            projection: "globe",
			style: {
				version: 8,
				sources: {
					"esri-terrain-base": {
						type: "raster",
						tiles: [ESRI_TERRAIN_BASE_URL],
						tileSize: 256,
						attribution: "Esri, USGS",
					},
					"esri-hillshade": {
						type: "raster",
						tiles: [ESRI_HILLSHADE_URL],
						tileSize: 256,
						attribution: "Esri",
					},
				},
				layers: [
					{
						id: "terrain-base-layer",
						type: "raster",
						source: "esri-terrain-base",
					},
					{
						id: "hillshade-layer",
						type: "raster",
						source: "esri-hillshade",
						paint: { "raster-opacity": 0.45 },
					},
				],
			},
			center: [35.2, 31.5],
			zoom: 5,
		});

		mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

		mapRef.current.on("load", () => {
			mapRef.current!.addSource("territories", {
				type: "geojson",
				data: { type: "FeatureCollection", features: [] },
			});
			mapRef.current!.addLayer({
				id: "territories-fill",
				type: "fill",
				source: "territories",
				paint: { "fill-color": "#8B5E34", "fill-opacity": 0.25 },
			});
			mapRef.current!.addLayer({
				id: "territories-outline",
				type: "line",
				source: "territories",
				paint: { "line-color": "#8B5E34", "line-width": 1.5 },
			});
			mapRef.current!.addSource("routes", {
				type: "geojson",
				data: { type: "FeatureCollection", features: [] },
			});
			mapRef.current!.addLayer({
				id: "routes-line",
				type: "line",
				source: "routes",
				paint: {
					"line-color": "#5B7C99",
					"line-width": 2,
					"line-dasharray": [3, 2],
				},
			});
			mapRef.current!.addLayer({
				id: "routes-waypoints",
				type: "circle",
				source: "routes",
				filter: ["==", ["geometry-type"], "Point"],
				paint: { "circle-radius": 4, "circle-color": "#5B7C99" },
			});
			mapRef.current!.addSource("draw-preview", {
				type: "geojson",
				data: { type: "FeatureCollection", features: [] },
			});
			mapRef.current!.addLayer({
				id: "draw-preview-fill",
				type: "fill",
				source: "draw-preview",
				filter: ["==", ["geometry-type"], "Polygon"],
				paint: { "fill-color": "#D85A30", "fill-opacity": 0.2 },
			});
			mapRef.current!.addLayer({
				id: "draw-preview-line",
				type: "line",
				source: "draw-preview",
				filter: ["==", ["geometry-type"], "LineString"],
				paint: {
					"line-color": "#D85A30",
					"line-width": 2,
					"line-dasharray": [2, 2],
				},
			});
			mapRef.current!.addLayer({
				id: "draw-preview-points",
				type: "circle",
				source: "draw-preview",
				filter: ["==", ["geometry-type"], "Point"],
				paint: { "circle-radius": 5, "circle-color": "#D85A30" },
			});
			mapRef.current!.addSource("route-draw-preview", {
				type: "geojson",
				data: { type: "FeatureCollection", features: [] },
			});
			mapRef.current!.addLayer({
				id: "route-draw-preview-line",
				type: "line",
				source: "route-draw-preview",
				filter: ["==", ["geometry-type"], "LineString"],
				paint: {
					"line-color": "#5B7C99",
					"line-width": 2,
					"line-dasharray": [2, 2],
				},
			});
			mapRef.current!.addLayer({
				id: "route-draw-preview-points",
				type: "circle",
				source: "route-draw-preview",
				filter: ["==", ["geometry-type"], "Point"],
				paint: { "circle-radius": 5, "circle-color": "#5B7C99" },
			});
			mapRef.current!.addSource("measure-preview", {
				type: "geojson",
				data: { type: "FeatureCollection", features: [] },
			});
			mapRef.current!.addLayer({
				id: "measure-preview-line",
				type: "line",
				source: "measure-preview",
				filter: ["==", ["geometry-type"], "LineString"],
				paint: { "line-color": "#333", "line-width": 2 },
			});
			mapRef.current!.addLayer({
				id: "measure-preview-points",
				type: "circle",
				source: "measure-preview",
				filter: ["==", ["geometry-type"], "Point"],
				paint: { "circle-radius": 5, "circle-color": "#333" },
			});
			mapRef.current!.addSource("measure-area-preview", {
				type: "geojson",
				data: { type: "FeatureCollection", features: [] },
			});
			mapRef.current!.addLayer({
				id: "measure-area-preview-fill",
				type: "fill",
				source: "measure-area-preview",
				filter: ["==", ["geometry-type"], "Polygon"],
				paint: { "fill-color": "#555", "fill-opacity": 0.2 },
			});
			mapRef.current!.addLayer({
				id: "measure-area-preview-line",
				type: "line",
				source: "measure-area-preview",
				filter: ["==", ["geometry-type"], "LineString"],
				paint: { "line-color": "#333", "line-width": 2 },
			});
			mapRef.current!.addLayer({
				id: "measure-area-preview-points",
				type: "circle",
				source: "measure-area-preview",
				filter: ["==", ["geometry-type"], "Point"],
				paint: { "circle-radius": 5, "circle-color": "#333" },
			});

			loadPlaces();
			loadNotes();
			loadTerritories(territoryYear);
			loadRoutes();
		});

		return () => {
			mapRef.current?.remove();
			mapRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!mapRef.current) return;
		const map = mapRef.current;

		function handleClick(e: maplibregl.MapMouseEvent) {
			if (measureAreaMode) {
				const newPoints: [number, number][] = [
					...measureAreaPoints,
					[e.lngLat.lng, e.lngLat.lat] as [number, number],
				];
				setMeasureAreaPoints(newPoints);
				updateMeasureAreaPreview(newPoints);

				if (newPoints.length > 2) {
					const polygon = turf.polygon([[...newPoints, newPoints[0]]]);
					const sqMeters = turf.area(polygon);
					const sqKm = sqMeters / 1_000_000;
					setMeasureArea(
						`${sqKm.toFixed(2)} km² (${(sqKm * 0.386102).toFixed(2)} mi²)`,
					);
				} else {
					setMeasureArea(null);
				}
				return;
			}

			if (measureMode) {
				const newPoints: [number, number][] = [
					...measurePoints,
					[e.lngLat.lng, e.lngLat.lat] as [number, number],
				].slice(-2);
				setMeasurePoints(newPoints);
				updateMeasurePreview(newPoints);

				if (newPoints.length === 2) {
					const line = turf.lineString(newPoints);
					const km = turf.length(line, { units: "kilometers" });
					setMeasureDistance(
						`${km.toFixed(1)} km (${(km * 0.621371).toFixed(1)} mi)`,
					);
				} else {
					setMeasureDistance(null);
				}
				return;
			}

			if (routeDrawMode) {
				const newWaypoints = [
					...routeWaypoints,
					{
						lat: e.lngLat.lat,
						lng: e.lngLat.lng,
						dateDisplay: "",
						dateSortValue: "",
					},
				];
				setRouteWaypoints(newWaypoints);
				updateRouteDrawPreview(newWaypoints);
				return;
			}

			if (drawMode) {
				const newPoints: [number, number][] = [
					...drawnPoints,
					[e.lngLat.lng, e.lngLat.lat],
				];
				setDrawnPoints(newPoints);
				updateDrawPreview(newPoints);
				return;
			}

			const features = map.getLayer("territories-fill")
				? map.queryRenderedFeatures(e.point, { layers: ["territories-fill"] })
				: [];
			if (features.length > 0) return;

			setSelectedPlace(null);
			setClickedCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
		}

		map.on("click", handleClick);
		return () => {
			map.off("click", handleClick);
		};
	}, [
		drawMode,
		drawnPoints,
		measureAreaMode,
		measureAreaPoints,
		measureMode,
		measurePoints,
		routeDrawMode,
		routeWaypoints,
	]);

	useEffect(() => {
		if (
			mapRef.current?.isStyleLoaded() &&
			mapRef.current?.getSource("territories")
		) {
			loadTerritories(territoryYear);
		}
	}, [territoryYear]);

	const addPlaceHref = clickedCoords
		? "/places/new?lat=" + clickedCoords.lat + "&lng=" + clickedCoords.lng
		: "";
	const addNoteHref = selectedPlace
		? "/notes/new?placeId=" + selectedPlace.id
		: "";

	return (
		<div style={{ position: "relative", width: "100%", height: "100vh" }}>
			<div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

			<div
				style={{
					position: "absolute",
					top: 12,
					left: 12,
					background: "white",
					padding: "0.5rem 0.75rem",
					borderRadius: 6,
					boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
					fontFamily: "sans-serif",
					fontSize: 13,
					display: "flex",
					flexDirection: "column",
					gap: 8,
				}}
			>
				<label>
					Show territories active in year:{" "}
					<input
						type="number"
						value={territoryYear}
						onChange={(e) =>
							setTerritoryYear(parseInt(e.target.value, 10) || 0)
						}
						style={{ width: 80 }}
					/>
					<span style={{ color: "#888" }}> (negative = BC)</span>
				</label>

				{!drawMode && !routeDrawMode && !measureMode && !measureAreaMode && (
					<button onClick={startMeasuring} style={{ alignSelf: "flex-start" }}>
						Measure distance
					</button>
				)}

				{!drawMode && !routeDrawMode && !measureMode && !measureAreaMode && (
					<button onClick={startDrawing} style={{ alignSelf: "flex-start" }}>
						Draw a territory
					</button>
				)}

				{!drawMode && !routeDrawMode && !measureMode && !measureAreaMode && (
					<button onClick={startRouteDrawing} style={{ alignSelf: "flex-start" }}>
						Draw a route
					</button>
				)}

				{!drawMode && !routeDrawMode && !measureMode && !measureAreaMode && (
					<button onClick={startMeasuringArea} style={{ alignSelf: "flex-start" }}>
						Measure area
					</button>
				)}

				{drawMode && !showTerritoryForm && (
					<div>
						<p style={{ margin: "4px 0" }}>
							Click the map to add points ({drawnPoints.length} so far).
						</p>
						<button onClick={finishDrawing} disabled={drawnPoints.length < 3}>
							Finish shape
						</button>{" "}
						<button onClick={cancelDrawing}>Cancel</button>
					</div>
				)}

				{territoryFormMessage && (
					<p style={{ color: "#0F6E56" }}>{territoryFormMessage}</p>
				)}

				{routeDrawMode && !showRouteForm && (
					<div>
						<p style={{ margin: "4px 0" }}>
							Click the map to add waypoints ({routeWaypoints.length} so far).
						</p>
						<button onClick={finishRouteDrawing} disabled={routeWaypoints.length < 2}>
							Finish route
						</button>{" "}
						<button onClick={cancelRouteDrawing}>Cancel</button>
					</div>
				)}

				{routeFormMessage && (
					<p style={{ color: "#0F6E56" }}>{routeFormMessage}</p>
				)}

				{measureMode && (
					<div>
						<p style={{ margin: "4px 0" }}>
							Click two points to measure.
							{measureDistance && <strong> {measureDistance}</strong>}
						</p>
						<button onClick={cancelMeasuring}>Done</button>
					</div>
				)}

				{measureAreaMode && (
					<div>
						<p style={{ margin: "4px 0" }}>
							Click points to outline an area ({measureAreaPoints.length} so far).
							{measureArea && (
								<>
									<br />
									<strong>{measureArea}</strong>
								</>
							)}
						</p>
						<button onClick={cancelMeasuringArea}>Done</button>
					</div>
				)}
			</div>

			{showTerritoryForm && (
				<div
					style={{
						position: "absolute",
						top: 12,
						right: 12,
						width: 300,
						background: "white",
						padding: "1rem",
						borderRadius: 8,
						boxShadow: "0 1px 8px rgba(0,0,0,0.2)",
						fontFamily: "sans-serif",
						fontSize: 13,
					}}
				>
					<h3 style={{ marginTop: 0 }}>New territory</h3>
					<form
						action={handleTerritorySubmit}
						style={{ display: "flex", flexDirection: "column", gap: 8 }}
					>
						<label>
							Name
							<input
								name="name"
								type="text"
								required
								style={{ width: "100%" }}
							/>
						</label>
						<label>
							Description
							<textarea name="description" style={{ width: "100%" }} />
						</label>
						<label>
							Start year (negative = BC)
							<input
								name="dateSortStart"
								type="number"
								required
								style={{ width: "100%" }}
							/>
						</label>
						<label>
							End year (leave blank if still in effect)
							<input
								name="dateSortEnd"
								type="number"
								style={{ width: "100%" }}
							/>
						</label>
						<button type="submit">Submit territory</button>
						<button type="button" onClick={cancelDrawing}>
							Cancel
						</button>
					</form>
				</div>
			)}

			{showRouteForm && (
				<div
					style={{
						position: "absolute",
						top: 12,
						right: 12,
						width: 320,
						maxHeight: "80vh",
						overflowY: "auto",
						background: "white",
						padding: "1rem",
						borderRadius: 8,
						boxShadow: "0 1px 8px rgba(0,0,0,0.2)",
						fontFamily: "sans-serif",
						fontSize: 13,
					}}
				>
					<h3 style={{ marginTop: 0 }}>New route</h3>
					<form
						action={handleRouteSubmit}
						style={{ display: "flex", flexDirection: "column", gap: 8 }}
					>
						<label>
							Name
							<input name="name" type="text" required style={{ width: "100%" }} />
						</label>
						<label>
							Description
							<textarea name="description" style={{ width: "100%" }} />
						</label>
						<div style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
							<strong>Waypoints (in order)</strong>
							{routeWaypoints.map((wp, i) => (
								<div
									key={i}
									style={{ marginTop: 6, paddingLeft: 8, borderLeft: "2px solid #ddd" }}
								>
									<div style={{ fontSize: 11, color: "#888" }}>
										#{i + 1}: {wp.lat.toFixed(3)}, {wp.lng.toFixed(3)}
									</div>
									<input
										type="text"
										placeholder="Date display (e.g. c. 1446 BC)"
										value={wp.dateDisplay}
										onChange={(e) => updateWaypointField(i, "dateDisplay", e.target.value)}
										style={{ width: "100%", marginTop: 2 }}
									/>
									<input
										type="number"
										placeholder="Sort year (negative = BC)"
										value={wp.dateSortValue}
										onChange={(e) => updateWaypointField(i, "dateSortValue", e.target.value)}
										style={{ width: "100%", marginTop: 2 }}
									/>
								</div>
							))}
						</div>
						<button type="submit">Submit route</button>
						<button type="button" onClick={cancelRouteDrawing}>
							Cancel
						</button>
					</form>
				</div>
			)}

			<Timeline
				notes={notes}
				loading={notesLoading}
				selectedNoteId={selectedNoteId}
				onSelectNote={handleSelectNote}
			/>

			{(clickedCoords || selectedPlace) && !drawMode && (
				<div
					style={{
						position: "absolute",
						top: 0,
						right: 0,
						width: 340,
						height: "100%",
						background: "white",
						boxShadow: "-2px 0 8px rgba(0,0,0,0.15)",
						padding: "1.5rem",
						overflowY: "auto",
						fontFamily: "sans-serif",
					}}
				>
					<button
						onClick={() => {
							setClickedCoords(null);
							setSelectedPlace(null);
						}}
						style={{
							float: "right",
							border: "none",
							background: "none",
							cursor: "pointer",
							fontSize: 18,
						}}
						aria-label="Close panel"
					>
						close
					</button>

					{clickedCoords && (
						<div>
							<h2>Add a place here</h2>
							<p style={{ color: "#666", fontSize: 13 }}>
								Lat: {clickedCoords.lat.toFixed(4)}, Lng:{" "}
								{clickedCoords.lng.toFixed(4)}
							</p>
							<a
								href={addPlaceHref}
								style={{ display: "inline-block", marginTop: 8 }}
							>
								Continue to place form
							</a>
						</div>
					)}

					{selectedPlace && (
						<div>
							<h2>{selectedPlace.name}</h2>
							<p style={{ fontSize: 13, color: "#666" }}>
								Confidence: {selectedPlace.confidence}
							</p>
							{selectedPlace.description && <p>{selectedPlace.description}</p>}
							<a href={addNoteHref}>Add a note to this place</a>
							<br />
							<form action={addPlaceBookmark.bind(null, selectedPlace.id)}>
								<button type="submit" style={{ marginTop: 8 }}>
									Bookmark this place
								</button>
							</form>
							<button
								type="button"
								onClick={() => {
									const url = `${window.location.origin}/places/${selectedPlace.id}`;
									navigator.clipboard.writeText(url);
									alert("Link copied: " + url);
								}}
								style={{ marginTop: 4 }}
							>
								Copy share link
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
