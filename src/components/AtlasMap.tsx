// src/components/AtlasMap.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import * as turf from "@turf/turf";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Timeline, { TimelineNote } from "./Timeline";
import EraBand from "./EraBand";
import NavBar from "./NavBar";
import SidePanel from "./SidePanel";
import RichTextEditor from "./RichTextEditor";
import MarkdownContent from "./MarkdownContent";
import { addPlaceBookmark } from "@/app/bookmarks/actions";
import { createTerritory } from "@/app/territories/actions";
import { createRoute } from "@/app/routes/actions";
import { createPlacePanel } from "@/app/places/panel-actions";
import { createNotePanel } from "@/app/notes/panel-actions";
import { createTribePanel } from "@/app/tribes/panel-actions";
import { createPersonPanel } from "@/app/people/panel-actions";

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

interface Tribe {
  id: string;
  name: string;
}

interface TerritoryDetail {
  id: string;
  name: string;
  description: string | null;
  scripture_reference: string | null;
  date_sort_start: number;
  date_sort_end: number | null;
  created_by: string;
}

interface RouteDetail {
  id: string;
  name: string;
  description: string | null;
  scripture_reference: string | null;
  date_sort_start: number | null;
  date_sort_end: number | null;
  created_by: string;
  waypoints?: Array<{ latitude: number; longitude: number; date_display: string | null; date_sort_value: number | null }>;
}

// Single source of truth for "what's currently active" on the map/UI.
// Opening any new panel clears whatever the previous one was doing.
type ActivePanel =
  | { kind: "none" }
  | { kind: "place-detail"; place: Place }
  | { kind: "place-form-awaiting-location" }
  | { kind: "place-form"; lat: number; lng: number; preservedFields?: Record<string, string> }
  | { kind: "note-form" }
  | { kind: "tribe-form" }
  | { kind: "person-form" }
  | { kind: "territory-detail"; territory: TerritoryDetail }
  | { kind: "territory-edit"; territory: TerritoryDetail }
  | { kind: "territory-draw" }
  | { kind: "territory-form" }
  | { kind: "route-detail"; route: RouteDetail }
  | { kind: "route-edit"; route: RouteDetail }
  | { kind: "route-draw" }
  | { kind: "route-form" }
  | { kind: "measure-distance" }
  | { kind: "measure-area" };

export default function AtlasMap() {
  const searchParams = useSearchParams();
  const focusPlaceId = searchParams.get("focusPlace");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const editingMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [activePanel, setActivePanel] = useState<ActivePanel>({ kind: "none" });
  const [editLat, setEditLat] = useState<number | null>(null);
  const [editLng, setEditLng] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; status: string } | null>(null);
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [notePlaces, setNotePlaces] = useState<{ id: string; name: string }[]>([]);
  const [myPlaces, setMyPlaces] = useState<{ id: string; name: string }[]>([]);
  const [myPeople, setMyPeople] = useState<{ id: string; name: string }[]>([]);
  const [myTerritories, setMyTerritories] = useState<{ id: string; name: string }[]>([]);
  const [myRoutes, setMyRoutes] = useState<{ id: string; name: string }[]>([]);
  const [placeFormMessage, setPlaceFormMessage] = useState<string | null>(null);
  const [noteFormMessage, setNoteFormMessage] = useState<string | null>(null);
  const [tribeFormMessage, setTribeFormMessage] = useState<string | null>(null);
  const [personFormMessage, setPersonFormMessage] = useState<string | null>(null);
  const [preservedPlaceFields, setPreservedPlaceFields] = useState<Record<string, string> | null>(null);
  const placeFormRef = useRef<HTMLFormElement | null>(null);

  const [notes, setNotes] = useState<TimelineNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const [territoryYear, setTerritoryYear] = useState<number>(-1000);

  // In-progress data for multi-point drawing / measuring. Cleared whenever
  // activePanel changes away from the relevant kind.
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);
  const [territoryFormMessage, setTerritoryFormMessage] = useState<string | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<
    { lat: number; lng: number; dateDisplay: string; dateSortValue: string }[]
  >([]);
  const [routeFormMessage, setRouteFormMessage] = useState<string | null>(null);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measureDistance, setMeasureDistance] = useState<string | null>(null);
  const [measureAreaPoints, setMeasureAreaPoints] = useState<[number, number][]>([]);
  const [measureArea, setMeasureArea] = useState<string | null>(null);

  function highlightMarker(placeId: string | null) {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      el.style.outline = id === placeId ? "3px solid #D85A30" : "none";
      el.style.outlineOffset = "2px";
    });
  }

  // Central panel switcher: setting any new panel clears all in-progress
  // drawing/measuring data from whatever was active before, per the
  // decision to never let two panels/modes collide.
  function openPanel(next: ActivePanel) {
    setDrawnPoints([]);
    setTerritoryFormMessage(null);
    setRouteWaypoints([]);
    setRouteFormMessage(null);
    setMeasurePoints([]);
    setMeasureDistance(null);
    setMeasureAreaPoints([]);
    setMeasureArea(null);
    setPlaceFormMessage(null);
    setNoteFormMessage(null);
    setTribeFormMessage(null);
    setPersonFormMessage(null);
    clearPreviewLayers();
    setActivePanel(next);
  }

  function clearPreviewLayers() {
    const emptyFC = { type: "FeatureCollection" as const, features: [] };
    (["draw-preview", "route-draw-preview", "measure-preview", "measure-area-preview"] as const).forEach((id) => {
      const src = mapRef.current?.getSource(id) as maplibregl.GeoJSONSource | undefined;
      src?.setData(emptyFC);
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
        if (activePanel.kind !== "none" && activePanel.kind !== "place-detail") return;
        openPanel({ kind: "place-detail", place });

        const relatedNote = notes.find((n) => n.place_id === place.id);
        if (relatedNote) {
          setSelectedNoteId(relatedNote.id);
          document.getElementById(`timeline-note-${relatedNote.id}`)?.scrollIntoView({
            behavior: "smooth",
            inline: "center",
          });
        }
        highlightMarker(place.id);
      });

      const marker = new maplibregl.Marker({ element: el }).setLngLat([place.longitude, place.latitude]).addTo(mapRef.current!);
      markersRef.current.set(place.id, marker);
    });

    if (focusPlaceId) {
      const focusPlace = places.find((p) => p.id === focusPlaceId);
      if (focusPlace) {
        mapRef.current?.flyTo({ center: [focusPlace.longitude, focusPlace.latitude], zoom: 9, duration: 1000 });
        openPanel({ kind: "place-detail", place: focusPlace });
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

  async function loadTribes() {
    const res = await fetch("/api/v1/tribes");
    const data = await res.json();
    setTribes(data.tribes ?? []);
  }

  async function loadNotePlaces() {
    const res = await fetch("/api/v1/places");
    const data = await res.json();
    setNotePlaces(data.places ?? []);
  }

  async function loadPersonFormPickerData() {
    const [placesRes, peopleRes, territoriesRes, routesRes] = await Promise.all([
      fetch("/api/v1/my-places"),
      fetch("/api/v1/my-people"),
      fetch("/api/v1/my-territories"),
      fetch("/api/v1/my-routes"),
    ]);
    const placesData = await placesRes.json();
    const peopleData = await peopleRes.json();
    const territoriesData = await territoriesRes.json();
    const routesData = await routesRes.json();
    setMyPlaces(placesData.places ?? []);
    setMyPeople(peopleData.people ?? []);
    setMyTerritories(territoriesData.territories ?? []);
    setMyRoutes(routesData.routes ?? []);
  }

  async function loadTerritories(year: number) {
    if (!mapRef.current) return;
    const res = await fetch(`/api/v1/territories?year=${year}`);
    const geojson = await res.json();
    const source = mapRef.current.getSource("territories") as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(geojson);
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
        waypoints: { latitude: number; longitude: number; date_display: string | null }[];
      }) => {
        if (route.waypoints.length < 2) return;
        features.push({
          type: "Feature",
          properties: { name: route.name, description: route.description, kind: "line" },
          geometry: { type: "LineString", coordinates: route.waypoints.map((w) => [w.longitude, w.latitude]) },
        });
        route.waypoints.forEach((w) => {
          features.push({
            type: "Feature",
            properties: { name: route.name, dateDisplay: w.date_display, kind: "waypoint" },
            geometry: { type: "Point", coordinates: [w.longitude, w.latitude] },
          });
        });
      }
    );

    const source = mapRef.current.getSource("routes") as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData({ type: "FeatureCollection", features });
  }

  function updateDrawPreview(points: [number, number][]) {
    const source = mapRef.current?.getSource("draw-preview") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const features: GeoJSON.Feature[] = points.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }));
    if (points.length > 1) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } });
    if (points.length > 2) features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...points, points[0]]] } });
    source.setData({ type: "FeatureCollection", features });
  }

  function updateRouteDrawPreview(points: { lat: number; lng: number }[]) {
    const source = mapRef.current?.getSource("route-draw-preview") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const coords = points.map((p) => [p.lng, p.lat]);
    const features: GeoJSON.Feature[] = coords.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } }));
    if (coords.length > 1) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
    source.setData({ type: "FeatureCollection", features });
  }

  function updateMeasurePreview(points: [number, number][]) {
    const source = mapRef.current?.getSource("measure-preview") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const features: GeoJSON.Feature[] = points.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }));
    if (points.length === 2) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } });
    source.setData({ type: "FeatureCollection", features });
  }

  function updateMeasureAreaPreview(points: [number, number][]) {
    const source = mapRef.current?.getSource("measure-area-preview") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const features: GeoJSON.Feature[] = points.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }));
    if (points.length > 1) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } });
    if (points.length > 2) features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...points, points[0]]] } });
    source.setData({ type: "FeatureCollection", features });
  }

  function handleSelectNote(note: TimelineNote) {
    setSelectedNoteId(note.id);
    if (note.places && mapRef.current) {
      mapRef.current.flyTo({ center: [note.places.longitude, note.places.latitude], zoom: 8, duration: 800 });
      if (note.place_id) highlightMarker(note.place_id);
    }
  }

  function finishDrawing() {
    if (drawnPoints.length < 3) {
      setTerritoryFormMessage("A territory needs at least 3 points.");
      return;
    }
    setActivePanel({ kind: "territory-form" });
  }

  function finishRouteDrawing() {
    if (routeWaypoints.length < 2) {
      setRouteFormMessage("A route needs at least 2 waypoints.");
      return;
    }
    setActivePanel({ kind: "route-form" });
  }

  async function handlePlaceSubmit(formData: FormData) {
    const result = await createPlacePanel(formData);
    if (result.error) {
      setPlaceFormMessage(result.error);
      return;
    }
    setPlaceFormMessage(`Place saved! ${result.published ? `Status: ${result.status}` : "Kept private."}`);
    loadPlaces();
    setTimeout(() => openPanel({ kind: "none" }), 1200);
  }

  async function handleTerritoryEditSubmit(territoryId: string, formData: FormData) {
    const { updateTerritoryPanel } = await import("@/app/territories/edit-panel-actions");
    const result = await updateTerritoryPanel(territoryId, formData);
    if ("error" in result && result.error) {
      setTerritoryFormMessage(result.error);
      return;
    }
    setTerritoryFormMessage(`Territory updated! ${result.published ? `Status: ${result.status}` : "Kept private."}`);
    loadTerritories(territoryYear);
    setTimeout(() => openPanel({ kind: "none" }), 1200);
  }

  async function handleRouteEditSubmit(routeId: string, formData: FormData) {
    const { updateRoutePanel } = await import("@/app/routes/edit-panel-actions");
    const result = await updateRoutePanel(routeId, formData);
    if ("error" in result && result.error) {
      setRouteFormMessage(result.error);
      return;
    }
    setRouteFormMessage(`Route updated! ${result.published ? `Status: ${result.status}` : "Kept private."}`);
    loadRoutes();
    setTimeout(() => openPanel({ kind: "none" }), 1200);
  }

  async function handleNoteSubmit(formData: FormData) {
    const result = await createNotePanel(formData);
    if (result.error) {
      setNoteFormMessage(result.error);
      return;
    }
    setNoteFormMessage(`Note saved! ${result.published ? `Status: ${result.status}` : "Kept private."}`);
    loadNotes();
    setTimeout(() => openPanel({ kind: "none" }), 1200);
  }

  async function handleTribeSubmit(formData: FormData) {
    const result = await createTribePanel(formData);
    if (result.error) {
      setTribeFormMessage(result.error);
      return;
    }
    setTribeFormMessage(`Tribe saved! ${result.published ? `Status: ${result.status}` : "Kept private."}`);
    loadTribes();
    setTimeout(() => openPanel({ kind: "none" }), 1200);
  }

  async function handlePersonSubmit(formData: FormData) {
    const result = await createPersonPanel(formData);
    if (result.error) {
      setPersonFormMessage(result.error);
      return;
    }
    setPersonFormMessage(`Person saved! ${result.published ? `Status: ${result.status}` : "Kept private."}`);
    setTimeout(() => openPanel({ kind: "none" }), 1200);
  }

  async function handleTerritorySubmit(formData: FormData) {
    const geometry = { type: "Polygon", coordinates: [[...drawnPoints, drawnPoints[0]]] };
    formData.set("geometry", JSON.stringify(geometry));
    const result = await createTerritory(formData);
    if (result.error) {
      setTerritoryFormMessage(result.error);
      return;
    }
    setTerritoryFormMessage(`Territory submitted! Status: ${result.status}`);
    loadTerritories(territoryYear);
    setTimeout(() => openPanel({ kind: "none" }), 1200);
  }

  async function handleRouteSubmit(formData: FormData) {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const scriptureReference = formData.get("scriptureReference") as string;
    const dateSortStart = formData.get("dateSortStart") ? parseInt(formData.get("dateSortStart") as string, 10) : null;
    const dateSortEnd = formData.get("dateSortEnd") ? parseInt(formData.get("dateSortEnd") as string, 10) : null;
    const publish = formData.get("publish") === "on";
    const personIds = formData.getAll("personIds") as string[];
    const waypointsForSubmit = routeWaypoints.map((wp) => ({
      lat: wp.lat,
      lng: wp.lng,
      dateDisplay: wp.dateDisplay,
      dateSortValue: wp.dateSortValue ? parseInt(wp.dateSortValue, 10) : null,
    }));
    const result = await createRoute(name, description, waypointsForSubmit, {
      scriptureReference,
      dateSortStart,
      dateSortEnd,
      personIds,
      publish,
    });
    if (result.error) {
      setRouteFormMessage(result.error);
      return;
    }
    setRouteFormMessage(`Route submitted! Status: ${result.status}`);
    loadRoutes();
    setTimeout(() => openPanel({ kind: "none" }), 1200);
  }

  function updateWaypointField(index: number, field: "dateDisplay" | "dateSortValue", value: string) {
    setRouteWaypoints((prev) => prev.map((wp, i) => (i === index ? { ...wp, [field]: value } : wp)));
  }

  function handleRepickLocation() {
    if (activePanel.kind !== "place-form" || !placeFormRef.current) return;

    const formData = new FormData(placeFormRef.current);
    const fields = Object.fromEntries(
      Array.from(formData.entries())
        .filter(([key]) =>
          [
            "name",
            "description",
            "sourceReference",
            "sourceUrl",
            "scriptureReference",
            "tribeId",
            "publish",
          ].includes(String(key))
        )
        .map(([key, value]) => [key, String(value ?? "")])
    ) as Record<string, string>;

    setPreservedPlaceFields(fields);
    setActivePanel({ kind: "place-form-awaiting-location" });
  }

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "esri-terrain-base": { type: "raster", tiles: [ESRI_TERRAIN_BASE_URL], tileSize: 256, attribution: "Esri, USGS" },
          "esri-hillshade": { type: "raster", tiles: [ESRI_HILLSHADE_URL], tileSize: 256, attribution: "Esri" },
        },
        layers: [
          { id: "terrain-base-layer", type: "raster", source: "esri-terrain-base" },
          { id: "hillshade-layer", type: "raster", source: "esri-hillshade", paint: { "raster-opacity": 0.45 } },
        ],
      },
      center: [35.2, 31.5],
      zoom: 5,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    mapRef.current.on("load", () => {
      mapRef.current!.addSource("territories", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapRef.current!.addLayer({ id: "territories-fill", type: "fill", source: "territories", paint: { "fill-color": "#8B5E34", "fill-opacity": 0.25 } });
      mapRef.current!.addLayer({ id: "territories-outline", type: "line", source: "territories", paint: { "line-color": "#8B5E34", "line-width": 1.5 } });

      mapRef.current!.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapRef.current!.addLayer({ id: "routes-line", type: "line", source: "routes", paint: { "line-color": "#5B7C99", "line-width": 2, "line-dasharray": [3, 2] } });
      mapRef.current!.addLayer({ id: "routes-waypoints", type: "circle", source: "routes", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 4, "circle-color": "#5B7C99" } });

      mapRef.current!.addSource("draw-preview", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapRef.current!.addLayer({ id: "draw-preview-fill", type: "fill", source: "draw-preview", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#D85A30", "fill-opacity": 0.2 } });
      mapRef.current!.addLayer({ id: "draw-preview-line", type: "line", source: "draw-preview", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#D85A30", "line-width": 2, "line-dasharray": [2, 2] } });
      mapRef.current!.addLayer({ id: "draw-preview-points", type: "circle", source: "draw-preview", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#D85A30" } });

      mapRef.current!.addSource("route-draw-preview", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapRef.current!.addLayer({ id: "route-draw-preview-line", type: "line", source: "route-draw-preview", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#5B7C99", "line-width": 2, "line-dasharray": [2, 2] } });
      mapRef.current!.addLayer({ id: "route-draw-preview-points", type: "circle", source: "route-draw-preview", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#5B7C99" } });

      mapRef.current!.addSource("measure-preview", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapRef.current!.addLayer({ id: "measure-preview-line", type: "line", source: "measure-preview", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#333", "line-width": 2 } });
      mapRef.current!.addLayer({ id: "measure-preview-points", type: "circle", source: "measure-preview", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#333" } });

      mapRef.current!.addSource("measure-area-preview", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapRef.current!.addLayer({ id: "measure-area-preview-fill", type: "fill", source: "measure-area-preview", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#555", "fill-opacity": 0.2 } });
      mapRef.current!.addLayer({ id: "measure-area-preview-line", type: "line", source: "measure-area-preview", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#333", "line-width": 2 } });
      mapRef.current!.addLayer({ id: "measure-area-preview-points", type: "circle", source: "measure-area-preview", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#333" } });

      loadPlaces();
      loadNotes();
      loadTribes();
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
    fetch("/api/v1/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setCurrentUser(data.user ?? null))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    function handleClick(e: maplibregl.MapMouseEvent) {
      const kind = activePanel.kind;

      if (kind === "place-form-awaiting-location") {
        setActivePanel({
          kind: "place-form",
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          preservedFields: preservedPlaceFields ?? undefined,
        });
        setPreservedPlaceFields(null);
        return;
      }

      if (kind === "none") {
        const territoryFeatures = map.getLayer("territories-fill") ? map.queryRenderedFeatures(e.point, { layers: ["territories-fill"] }) : [];
        if (territoryFeatures.length > 0) {
          const territoryId = territoryFeatures[0].properties?.id ?? territoryFeatures[0].id;
          if (territoryId) {
            fetch(`/api/v1/territories/${territoryId}`)
              .then((res) => res.json())
              .then((data) => {
                if (data.territory) setActivePanel({ kind: "territory-detail", territory: data.territory });
              });
          }
          return;
        }

        const routeFeatures = map.getLayer("routes-line") ? map.queryRenderedFeatures(e.point, { layers: ["routes-line", "routes-waypoints"] }) : [];
        if (routeFeatures.length > 0) {
          const routeId = routeFeatures[0].properties?.id ?? routeFeatures[0].id;
          if (routeId) {
            fetch(`/api/v1/routes/${routeId}`)
              .then((res) => res.json())
              .then((data) => {
                if (data.route) setActivePanel({ kind: "route-detail", route: data.route });
              });
          }
          return;
        }
      }

      if (kind === "measure-area") {
        const newPoints: [number, number][] = [...measureAreaPoints, [e.lngLat.lng, e.lngLat.lat]];
        setMeasureAreaPoints(newPoints);
        updateMeasureAreaPreview(newPoints);
        if (newPoints.length > 2) {
          const polygon = turf.polygon([[...newPoints, newPoints[0]]]);
          const sqKm = turf.area(polygon) / 1_000_000;
          setMeasureArea(`${sqKm.toFixed(2)} km² (${(sqKm * 0.386102).toFixed(2)} mi²)`);
        } else {
          setMeasureArea(null);
        }
        return;
      }

      if (kind === "measure-distance") {
        const newPoints = [...measurePoints, [e.lngLat.lng, e.lngLat.lat] as [number, number]].slice(-2) as [number, number][];
        setMeasurePoints(newPoints);
        updateMeasurePreview(newPoints);
        if (newPoints.length === 2) {
          const line = turf.lineString(newPoints);
          const km = turf.length(line, { units: "kilometers" });
          setMeasureDistance(`${km.toFixed(1)} km (${(km * 0.621371).toFixed(1)} mi)`);
        } else {
          setMeasureDistance(null);
        }
        return;
      }

      if (kind === "route-draw") {
        const newWaypoints = [...routeWaypoints, { lat: e.lngLat.lat, lng: e.lngLat.lng, dateDisplay: "", dateSortValue: "" }];
        setRouteWaypoints(newWaypoints);
        updateRouteDrawPreview(newWaypoints);
        return;
      }

      if (kind === "territory-draw") {
        const newPoints = [...drawnPoints, [e.lngLat.lng, e.lngLat.lat] as [number, number]] as [number, number][];
        setDrawnPoints(newPoints);
        updateDrawPreview(newPoints);
        return;
      }

      if (kind !== "none") return;

      const features = map.getLayer("territories-fill") ? map.queryRenderedFeatures(e.point, { layers: ["territories-fill"] }) : [];
      if (features.length > 0) return;

      openPanel({ kind: "place-form", lat: e.lngLat.lat, lng: e.lngLat.lng });
    }

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [activePanel, drawnPoints, routeWaypoints, measurePoints, measureAreaPoints, preservedPlaceFields]);

  useEffect(() => {
    if (activePanel.kind === "place-form") {
      const lat = activePanel.lat;
      const lng = activePanel.lng;
      setEditLat(lat);
      setEditLng(lng);

      if (!mapRef.current) return;

      editingMarkerRef.current?.remove();
      const el = document.createElement("div");
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "50%";
      el.style.background = "#D85A30";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 0 2px #D85A30";
      el.style.cursor = "pointer";

      editingMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
      return;
    }

    editingMarkerRef.current?.remove();
    editingMarkerRef.current = null;
    setEditLat(null);
    setEditLng(null);
  }, [activePanel]);

  useEffect(() => {
    if (mapRef.current?.isStyleLoaded() && mapRef.current?.getSource("territories")) {
      loadTerritories(territoryYear);
    }
  }, [territoryYear]);

  const panelKind = activePanel.kind;

  return (
    <div className="relative w-full h-screen">
      <NavBar
        isLoggedIn={!!currentUser}
        isAdmin={currentUser?.role === "admin"}
        unreadNotifications={0}
        onAddPlace={() => openPanel({ kind: "place-form-awaiting-location" })}
        onAddTerritory={() => openPanel({ kind: "territory-draw" })}
        onAddRoute={() => openPanel({ kind: "route-draw" })}
        onAddNote={() => {
          loadNotePlaces();
          openPanel({ kind: "note-form" });
        }}
        onAddTribe={() => openPanel({ kind: "tribe-form" })}
        onAddPerson={() => {
          loadPersonFormPickerData();
          openPanel({ kind: "person-form" });
        }}
      />
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top-left controls: year filter + measure/draw triggers, only when idle */}
      <div className="absolute top-16 left-3 bg-white/95 rounded-md shadow-sm px-3 py-2 font-sans text-sm flex flex-col gap-2 text-clay-900">
        <label>
          Show territories active in year:{" "}
          <input
            type="number"
            value={territoryYear}
            onChange={(e) => setTerritoryYear(parseInt(e.target.value, 10) || 0)}
            className="w-20 border border-clay-200 rounded px-1"
          />
          <span className="text-clay-600"> (negative = BC)</span>
        </label>

        {panelKind === "none" && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => openPanel({ kind: "measure-distance" })} className="text-xs underline">
              Measure distance
            </button>
            <button onClick={() => openPanel({ kind: "measure-area" })} className="text-xs underline">
              Measure area
            </button>
          </div>
        )}

        {panelKind === "place-form-awaiting-location" && (
          <p className="text-clay-600 font-medium">Please choose a location on the map.</p>
        )}

        {panelKind === "territory-draw" && (
          <div>
            <p className="my-1">Click the map to add points ({drawnPoints.length} so far).</p>
            <button onClick={finishDrawing} disabled={drawnPoints.length < 3} className="text-xs underline disabled:opacity-40">
              Finish shape
            </button>{" "}
            <button onClick={() => openPanel({ kind: "none" })} className="text-xs underline">
              Cancel
            </button>
          </div>
        )}
        {territoryFormMessage && <p className="text-green-700">{territoryFormMessage}</p>}

        {panelKind === "route-draw" && (
          <div>
            <p className="my-1">Click the map to add waypoints ({routeWaypoints.length} so far).</p>
            <button onClick={finishRouteDrawing} disabled={routeWaypoints.length < 2} className="text-xs underline disabled:opacity-40">
              Finish route
            </button>{" "}
            <button onClick={() => openPanel({ kind: "none" })} className="text-xs underline">
              Cancel
            </button>
          </div>
        )}
        {routeFormMessage && <p className="text-green-700">{routeFormMessage}</p>}

        {panelKind === "measure-distance" && (
          <div>
            <p className="my-1">
              Click two points to measure. {measureDistance && <strong>{measureDistance}</strong>}
            </p>
            <button onClick={() => openPanel({ kind: "none" })} className="text-xs underline">
              Done
            </button>
          </div>
        )}

        {panelKind === "measure-area" && (
          <div>
            <p className="my-1">
              Click points to outline an area ({measureAreaPoints.length} so far).
              {measureArea && (
                <>
                  <br />
                  <strong>{measureArea}</strong>
                </>
              )}
            </p>
            <button onClick={() => openPanel({ kind: "none" })} className="text-xs underline">
              Done
            </button>
          </div>
        )}
      </div>

      {panelKind === "territory-detail" && (
        <SidePanel title={activePanel.territory.name} onClose={() => openPanel({ kind: "none" })}>
          <div className="space-y-3">
            {activePanel.territory.description && <MarkdownContent content={activePanel.territory.description} />}
            {activePanel.territory.scripture_reference && (
              <p className="text-sm text-clay-600">Scripture: {activePanel.territory.scripture_reference}</p>
            )}
            <p className="text-sm text-clay-600">
              Date range: {activePanel.territory.date_sort_start} to {activePanel.territory.date_sort_end ?? "present"}
            </p>
            {currentUser && (currentUser.id === activePanel.territory.created_by || currentUser.role === "admin") && (
              <button
                type="button"
                onClick={() => setActivePanel({ kind: "territory-edit", territory: activePanel.territory })}
                className="bg-clay-100 text-clay-900 rounded px-3 py-1.5 text-sm"
              >
                Edit territory
              </button>
            )}
          </div>
        </SidePanel>
      )}

      {panelKind === "route-detail" && (
        <SidePanel title={activePanel.route.name} onClose={() => openPanel({ kind: "none" })}>
          <div className="space-y-3">
            {activePanel.route.description && <MarkdownContent content={activePanel.route.description} />}
            {activePanel.route.scripture_reference && (
              <p className="text-sm text-clay-600">Scripture: {activePanel.route.scripture_reference}</p>
            )}
            <p className="text-sm text-clay-600">
              Date range: {activePanel.route.date_sort_start ?? "—"} to {activePanel.route.date_sort_end ?? "—"}
            </p>
            {currentUser && (currentUser.id === activePanel.route.created_by || currentUser.role === "admin") && (
              <button
                type="button"
                onClick={() => setActivePanel({ kind: "route-edit", route: activePanel.route })}
                className="bg-clay-100 text-clay-900 rounded px-3 py-1.5 text-sm"
              >
                Edit route
              </button>
            )}
          </div>
        </SidePanel>
      )}

      {panelKind === "territory-form" && (
        <SidePanel title="New territory" onClose={() => openPanel({ kind: "none" })}>
          <form action={handleTerritorySubmit} className="flex flex-col gap-3">
            <label>
              Name
              <input name="name" type="text" required className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Description
              <RichTextEditor name="description" />
            </label>
            <label>
              Scripture reference
              <input name="scriptureReference" type="text" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Start year (negative = BC)
              <input name="dateSortStart" type="number" required className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              End year (leave blank if still in effect)
              <input name="dateSortEnd" type="number" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <fieldset className="border border-clay-100 rounded p-2">
              <legend className="text-xs text-clay-600 px-1">Associated people</legend>
              {myPeople.map((person) => (
                <label key={person.id} className="block text-sm">
                  <input type="checkbox" name="personIds" value={person.id} className="accent-clay-600" /> {person.name}
                </label>
              ))}
              {myPeople.length === 0 && <p className="text-xs text-clay-600">None available yet.</p>}
            </fieldset>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="publish" className="accent-clay-600" />
              Publish (Submit for public review)
            </label>
            <button type="submit" className="bg-clay-600 text-white rounded px-3 py-2">
              Submit territory
            </button>
          </form>
          {territoryFormMessage && <p className="text-green-700 mt-2">{territoryFormMessage}</p>}
        </SidePanel>
      )}

      {panelKind === "territory-edit" && (
        <SidePanel title={`Edit ${activePanel.territory.name}`} onClose={() => openPanel({ kind: "none" })}>
          <form action={(formData) => handleTerritoryEditSubmit(activePanel.territory.id, formData)} className="flex flex-col gap-3">
            <label>
              Name
              <input name="name" type="text" required defaultValue={activePanel.territory.name} className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Description
              <RichTextEditor name="description" defaultValue={activePanel.territory.description ?? ""} />
            </label>
            <label>
              Scripture reference
              <input name="scriptureReference" type="text" defaultValue={activePanel.territory.scripture_reference ?? ""} className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Start year (negative = BC)
              <input name="dateSortStart" type="number" required defaultValue={activePanel.territory.date_sort_start} className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              End year (leave blank if still in effect)
              <input name="dateSortEnd" type="number" defaultValue={activePanel.territory.date_sort_end ?? ""} className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <fieldset className="border border-clay-100 rounded p-2">
              <legend className="text-xs text-clay-600 px-1">Associated people</legend>
              {myPeople.map((person) => (
                <label key={person.id} className="block text-sm">
                  <input type="checkbox" name="personIds" value={person.id} className="accent-clay-600" /> {person.name}
                </label>
              ))}
              {myPeople.length === 0 && <p className="text-xs text-clay-600">None available yet.</p>}
            </fieldset>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="publish" className="accent-clay-600" />
              Publish (Submit for public review)
            </label>
            <button type="submit" className="bg-clay-600 text-white rounded px-3 py-2">
              Save territory
            </button>
          </form>
          {territoryFormMessage && <p className="text-green-700 mt-2">{territoryFormMessage}</p>}
        </SidePanel>
      )}

      {panelKind === "route-form" && (
        <SidePanel title="New route" onClose={() => openPanel({ kind: "none" })}>
          <form action={handleRouteSubmit} className="flex flex-col gap-3">
            <label>
              Name
              <input name="name" type="text" required className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Description
              <RichTextEditor name="description" />
            </label>
            <label>
              Scripture reference
              <input name="scriptureReference" type="text" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Start year (negative = BC)
              <input name="dateSortStart" type="number" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              End year (leave blank if still in effect)
              <input name="dateSortEnd" type="number" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <div className="border-t border-clay-100 pt-2">
              <strong>Waypoints (in order)</strong>
              {routeWaypoints.map((wp, i) => (
                <div key={i} className="mt-1.5 pl-2 border-l-2 border-clay-100">
                  <div className="text-xs text-clay-600">
                    #{i + 1}: {wp.lat.toFixed(3)}, {wp.lng.toFixed(3)}
                  </div>
                  <input
                    type="text"
                    placeholder="Date display (e.g. c. 1446 BC)"
                    value={wp.dateDisplay}
                    onChange={(e) => updateWaypointField(i, "dateDisplay", e.target.value)}
                    className="w-full border border-clay-200 rounded px-1 mt-0.5"
                  />
                  <input
                    type="number"
                    placeholder="Sort year (negative = BC)"
                    value={wp.dateSortValue}
                    onChange={(e) => updateWaypointField(i, "dateSortValue", e.target.value)}
                    className="w-full border border-clay-200 rounded px-1 mt-0.5"
                  />
                </div>
              ))}
            </div>
            <fieldset className="border border-clay-100 rounded p-2">
              <legend className="text-xs text-clay-600 px-1">Associated people</legend>
              {myPeople.map((person) => (
                <label key={person.id} className="block text-sm">
                  <input type="checkbox" name="personIds" value={person.id} className="accent-clay-600" /> {person.name}
                </label>
              ))}
              {myPeople.length === 0 && <p className="text-xs text-clay-600">None available yet.</p>}
            </fieldset>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="publish" className="accent-clay-600" />
              Publish (Submit for public review)
            </label>
            <button type="submit" className="bg-clay-600 text-white rounded px-3 py-2">
              Submit route
            </button>
          </form>
          {routeFormMessage && <p className="text-green-700 mt-2">{routeFormMessage}</p>}
        </SidePanel>
      )}

      {panelKind === "route-edit" && (
        <SidePanel title={`Edit ${activePanel.route.name}`} onClose={() => openPanel({ kind: "none" })}>
          <form action={(formData) => handleRouteEditSubmit(activePanel.route.id, formData)} className="flex flex-col gap-3">
            <label>
              Name
              <input name="name" type="text" required defaultValue={activePanel.route.name} className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Description
              <RichTextEditor name="description" defaultValue={activePanel.route.description ?? ""} />
            </label>
            <label>
              Scripture reference
              <input name="scriptureReference" type="text" defaultValue={activePanel.route.scripture_reference ?? ""} className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Start year (negative = BC)
              <input name="dateSortStart" type="number" defaultValue={activePanel.route.date_sort_start ?? ""} className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              End year (leave blank if still in effect)
              <input name="dateSortEnd" type="number" defaultValue={activePanel.route.date_sort_end ?? ""} className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <fieldset className="border border-clay-100 rounded p-2">
              <legend className="text-xs text-clay-600 px-1">Associated people</legend>
              {myPeople.map((person) => (
                <label key={person.id} className="block text-sm">
                  <input type="checkbox" name="personIds" value={person.id} className="accent-clay-600" /> {person.name}
                </label>
              ))}
              {myPeople.length === 0 && <p className="text-xs text-clay-600">None available yet.</p>}
            </fieldset>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="publish" className="accent-clay-600" />
              Publish (Submit for public review)
            </label>
            <button type="submit" className="bg-clay-600 text-white rounded px-3 py-2">
              Save route
            </button>
          </form>
          {routeFormMessage && <p className="text-green-700 mt-2">{routeFormMessage}</p>}
        </SidePanel>
      )}

      {panelKind === "place-form" && (
        <SidePanel title="New place" onClose={() => openPanel({ kind: "none" })}>
          <form ref={placeFormRef} action={handlePlaceSubmit} className="flex flex-col gap-3">
            <div className="flex gap-2 items-end">
              <label className="flex-1">
                Latitude
                <input
                  name="latitude"
                  type="number"
                  step="any"
                  value={editLat ?? ""}
                  onChange={(e) => {
                    const next = e.target.value === "" ? null : Number(e.target.value);
                    setEditLat(next);
                    if (next !== null && editLng !== null) {
                      editingMarkerRef.current?.setLngLat([editLng, next]);
                    }
                    if (activePanel.kind === "place-form") {
                      setActivePanel((prev) =>
                        prev.kind === "place-form" ? { ...prev, lat: next ?? prev.lat } : prev
                      );
                    }
                  }}
                  required
                  className="w-full border border-clay-200 rounded px-2 py-1"
                />
              </label>
              <label className="flex-1">
                Longitude
                <input
                  name="longitude"
                  type="number"
                  step="any"
                  value={editLng ?? ""}
                  onChange={(e) => {
                    const next = e.target.value === "" ? null : Number(e.target.value);
                    setEditLng(next);
                    if (next !== null && editLat !== null) {
                      editingMarkerRef.current?.setLngLat([next, editLat]);
                    }
                    if (activePanel.kind === "place-form") {
                      setActivePanel((prev) =>
                        prev.kind === "place-form" ? { ...prev, lng: next ?? prev.lng } : prev
                      );
                    }
                  }}
                  required
                  className="w-full border border-clay-200 rounded px-2 py-1"
                />
              </label>
              <button
                type="button"
                onClick={handleRepickLocation}
                aria-label="Choose location on map"
                title="Choose location on map"
                className="bg-clay-100 rounded px-2 py-1.5 shrink-0"
              >
                <MapPin size={16} />
              </button>
            </div>
            <p className="text-xs text-clay-600">
              {activePanel.kind === "place-form" ? `${activePanel.lat.toFixed(4)}, ${activePanel.lng.toFixed(4)}` : ""}
            </p>
            <label>
              Name
              <input
                name="name"
                type="text"
                required
                defaultValue={activePanel.kind === "place-form" ? activePanel.preservedFields?.name ?? "" : ""}
                className="w-full border border-clay-200 rounded px-2 py-1"
              />
            </label>
            <label>
              Description
              <RichTextEditor
                name="description"
                defaultValue={activePanel.kind === "place-form" ? activePanel.preservedFields?.description ?? "" : ""}
              />
            </label>
            <label>
              Source reference
              <input
                name="sourceReference"
                type="text"
                defaultValue={activePanel.kind === "place-form" ? activePanel.preservedFields?.sourceReference ?? "" : ""}
                className="w-full border border-clay-200 rounded px-2 py-1"
              />
            </label>
            <label>
              Source URL
              <input
                name="sourceUrl"
                type="url"
                defaultValue={activePanel.kind === "place-form" ? activePanel.preservedFields?.sourceUrl ?? "" : ""}
                className="w-full border border-clay-200 rounded px-2 py-1"
              />
            </label>
            <label>
              Scripture reference
              <input
                name="scriptureReference"
                type="text"
                defaultValue={activePanel.kind === "place-form" ? activePanel.preservedFields?.scriptureReference ?? "" : ""}
                className="w-full border border-clay-200 rounded px-2 py-1"
              />
            </label>
            <label>
              Tribe
              <select
                name="tribeId"
                defaultValue={activePanel.kind === "place-form" ? activePanel.preservedFields?.tribeId ?? "" : ""}
                className="w-full border border-clay-200 rounded px-2 py-1"
              >
                <option value="">— none —</option>
                {tribes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="publish"
                defaultChecked={activePanel.kind === "place-form" ? activePanel.preservedFields?.publish === "on" : false}
                className="accent-clay-600"
              />
              Publish (Submit for public review)
            </label>
            <button type="submit" className="bg-clay-600 text-white rounded px-3 py-2">
              Save place
            </button>
          </form>
          {placeFormMessage && <p className="text-green-700 mt-2">{placeFormMessage}</p>}
        </SidePanel>
      )}

      {panelKind === "note-form" && (
        <SidePanel title="New note" onClose={() => openPanel({ kind: "none" })}>
          <form action={handleNoteSubmit} className="flex flex-col gap-3">
            <label>
              Place (optional)
              <select name="placeId" className="w-full border border-clay-200 rounded px-2 py-1">
                <option value="">— none —</option>
                {notePlaces.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input name="title" type="text" required className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Body
              <RichTextEditor name="body" />
            </label>
            <label>
              Date display text (e.g. "c. 1446 BC")
              <input name="dateDisplay" type="text" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Date sort value (negative = BC)
              <input name="dateSortStart" type="number" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="approximate" className="accent-clay-600" />
              Date is approximate
            </label>
            <label>
              Scripture reference
              <input name="scriptureReference" type="text" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="publish" className="accent-clay-600" />
              Publish (Submit for public review)
            </label>
            <button type="submit" className="bg-clay-600 text-white rounded px-3 py-2">Save note</button>
          </form>
          {noteFormMessage && <p className="text-green-700 mt-2">{noteFormMessage}</p>}
        </SidePanel>
      )}

      {panelKind === "tribe-form" && (
        <SidePanel title="New tribe / nation" onClose={() => openPanel({ kind: "none" })}>
          <form action={handleTribeSubmit} className="flex flex-col gap-3">
            <label>
              Name
              <input name="name" type="text" required className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Description
              <RichTextEditor name="description" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="publish" className="accent-clay-600" />
              Publish (Submit for public review)
            </label>
            <button type="submit" className="bg-clay-600 text-white rounded px-3 py-2">Save tribe</button>
          </form>
          {tribeFormMessage && <p className="text-green-700 mt-2">{tribeFormMessage}</p>}
        </SidePanel>
      )}

      {panelKind === "person-form" && (
        <SidePanel title="New person" onClose={() => openPanel({ kind: "none" })}>
          <form action={handlePersonSubmit} className="flex flex-col gap-3">
            <label>
              Name
              <input name="name" type="text" required className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Description
              <RichTextEditor name="description" />
            </label>
            <label>
              Birth year (negative = BC)
              <input name="birthDateSort" type="number" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Death year (negative = BC)
              <input name="deathDateSort" type="number" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <label>
              Tribe / nation
              <select name="tribeId" className="w-full border border-clay-200 rounded px-2 py-1">
                <option value="">— none —</option>
                {tribes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label>
              Scripture reference
              <input name="scriptureReference" type="text" className="w-full border border-clay-200 rounded px-2 py-1" />
            </label>
            <fieldset className="border border-clay-100 rounded p-2">
              <legend className="text-xs text-clay-600 px-1">Associated places</legend>
              {myPlaces.map((p) => (
                <label key={p.id} className="block text-sm">
                  <input type="checkbox" name="placeIds" value={p.id} className="accent-clay-600" /> {p.name}
                </label>
              ))}
              {myPlaces.length === 0 && <p className="text-xs text-clay-600">None available yet.</p>}
            </fieldset>
            <fieldset className="border border-clay-100 rounded p-2">
              <legend className="text-xs text-clay-600 px-1">Associated territories</legend>
              {myTerritories.map((t) => (
                <label key={t.id} className="block text-sm">
                  <input type="checkbox" name="territoryIds" value={t.id} className="accent-clay-600" /> {t.name}
                </label>
              ))}
              {myTerritories.length === 0 && <p className="text-xs text-clay-600">None available yet.</p>}
            </fieldset>
            <fieldset className="border border-clay-100 rounded p-2">
              <legend className="text-xs text-clay-600 px-1">Associated routes</legend>
              {myRoutes.map((r) => (
                <label key={r.id} className="block text-sm">
                  <input type="checkbox" name="routeIds" value={r.id} className="accent-clay-600" /> {r.name}
                </label>
              ))}
              {myRoutes.length === 0 && <p className="text-xs text-clay-600">None available yet.</p>}
            </fieldset>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="publish" className="accent-clay-600" />
              Publish (Submit for public review)
            </label>
            <button type="submit" className="bg-clay-600 text-white rounded px-3 py-2">Save person</button>
          </form>
          {personFormMessage && <p className="text-green-700 mt-2">{personFormMessage}</p>}
        </SidePanel>
      )}

      {panelKind === "place-detail" && (
        <SidePanel title={activePanel.place.name} onClose={() => openPanel({ kind: "none" })}>
          <p className="text-sm text-clay-600">Confidence: {activePanel.place.confidence}</p>
          {activePanel.place.description && <MarkdownContent content={activePanel.place.description} />}
          <a href={`/notes/new?placeId=${activePanel.place.id}`} className="block mt-2 text-clay-600 underline">
            Add a note to this place
          </a>
          <a href={`/places/${activePanel.place.id}`} className="block mt-1 text-clay-600 underline">
            View full page
          </a>
          <form action={addPlaceBookmark.bind(null, activePanel.place.id)}>
            <button type="submit" className="mt-3 bg-clay-100 text-clay-900 rounded px-3 py-1.5 text-sm">
              Bookmark this place
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/places/${activePanel.kind === "place-detail" ? activePanel.place.id : ""}`;
              navigator.clipboard.writeText(url);
              alert("Link copied: " + url);
            }}
            className="mt-2 bg-clay-100 text-clay-900 rounded px-3 py-1.5 text-sm block"
          >
            Copy share link
          </button>
        </SidePanel>
      )}

      <EraBand />
      <Timeline notes={notes} loading={notesLoading} selectedNoteId={selectedNoteId} onSelectNote={handleSelectNote} />
    </div>
  );
}