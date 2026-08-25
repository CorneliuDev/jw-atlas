"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Timeline, { TimelineNote } from "./Timeline";

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const [notes, setNotes] = useState<TimelineNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const [territoryYear, setTerritoryYear] = useState<number>(-1000);

  function highlightMarker(placeId: string | null) {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      el.style.outline = id === placeId ? "3px solid #D85A30" : "none";
      el.style.outlineOffset = "2px";
    });
  }

  async function loadPlaces() {
    const res = await fetch("/api/v1/places");
    const { places } = (await res.json()) as { places: Place[] };

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
        setClickedCoords(null);
        setSelectedPlace(place);

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

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(mapRef.current!);

      markersRef.current.set(place.id, marker);
    });
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

    const source = mapRef.current.getSource("territories") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }
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

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
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
          { id: "terrain-base-layer", type: "raster", source: "esri-terrain-base" },
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

    mapRef.current.on("click", (e) => {
      const features = mapRef.current!.getLayer("territories-fill")
        ? mapRef.current!.queryRenderedFeatures(e.point, { layers: ["territories-fill"] })
        : [];
      if (features.length > 0) return;
      setSelectedPlace(null);
      setClickedCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

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

      loadPlaces();
      loadNotes();
      loadTerritories(territoryYear);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current?.isStyleLoaded() && mapRef.current?.getSource("territories")) {
      loadTerritories(territoryYear);
    }
  }, [territoryYear]);

  const addPlaceHref = clickedCoords
    ? "/places/new?lat=" + clickedCoords.lat + "&lng=" + clickedCoords.lng
    : "";
  const addNoteHref = selectedPlace ? "/notes/new?placeId=" + selectedPlace.id : "";

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
        }}
      >
        <label>
          Show territories active in year:{" "}
          <input
            type="number"
            value={territoryYear}
            onChange={(e) => setTerritoryYear(parseInt(e.target.value, 10) || 0)}
            style={{ width: 80 }}
          />
          <span style={{ color: "#888" }}> (negative = BC)</span>
        </label>
      </div>

      <Timeline
        notes={notes}
        loading={notesLoading}
        selectedNoteId={selectedNoteId}
        onSelectNote={handleSelectNote}
      />

      {(clickedCoords || selectedPlace) && (
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
            style={{ float: "right", border: "none", background: "none", cursor: "pointer", fontSize: 18 }}
            aria-label="Close panel"
          >
            close
          </button>

          {clickedCoords && (
            <div>
              <h2>Add a place here</h2>
              <p style={{ color: "#666", fontSize: 13 }}>
                Lat: {clickedCoords.lat.toFixed(4)}, Lng: {clickedCoords.lng.toFixed(4)}
              </p>
              <a href={addPlaceHref} style={{ display: "inline-block", marginTop: 8 }}>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}