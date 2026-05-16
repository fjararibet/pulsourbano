import { useCallback, useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { mockStations } from "#/lib/air-quality-mock";
import { getAqiColor } from "#/lib/air-quality-types";
import { computeAqiAt, fieldConfig, fieldStations } from "#/lib/aqi-field";
import { comunasRM } from "#/lib/comunas-rm";
import { fetchCustomStyle } from "#/lib/map-style";
import { createAqiFieldLayer } from "./AqiFieldLayer";

const SANTIAGO = {
	center: { longitude: -70.6693, latitude: -33.4489 },
	bounds: [-70.85, -33.65, -70.45, -33.25] as [number, number, number, number],
	minZoom: 10,
	defaultZoom: 12,
};

interface CityMapProps {
	showStations: boolean;
	isEditMode: boolean;
	showHeatmap: boolean;
	isSelectingRegion: boolean;
	selectedComunas: string[];
	onToggleComuna: (name: string) => void;
}

interface TooltipData {
	x: number;
	y: number;
	aqi: number;
}

export default function CityMap({
	showStations,
	isEditMode,
	showHeatmap,
	isSelectingRegion,
	selectedComunas,
	onToggleComuna,
}: CityMapProps) {
	const [isClient, setIsClient] = useState(false);
	// biome-ignore lint/suspicious/noExplicitAny: style JSON is dynamic
	const [mapStyle, setMapStyle] = useState<any>(null);
	const [mapReady, setMapReady] = useState(false);
	const [tooltip, setTooltip] = useState<TooltipData | null>(null);
	const mapRef = useRef<MapRef | null>(null);
	const markersRef = useRef<maplibregl.Marker[]>([]);

	useEffect(() => {
		setIsClient(true);
		fetchCustomStyle().then(setMapStyle);
	}, []);

	const handleMapLoad = useCallback(() => {
		const map = mapRef.current?.getMap();
		if (!map) return;
		setMapReady(true);

		// Add comuna GeoJSON source
		if (!map.getSource("comunas-rm")) {
			map.addSource("comunas-rm", {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: comunasRM.map((c) => ({
						type: "Feature" as const,
						properties: { Comuna: c.name },
						geometry: {
							type: "Polygon" as const,
							coordinates: c.coords,
						},
					})),
				},
			});
		}

		// Comuna boundary line (always visible but subtle)
		if (!map.getLayer("comunas-line")) {
			map.addLayer({
				id: "comunas-line",
				type: "line",
				source: "comunas-rm",
				paint: {
					"line-color": "#ffffff",
					"line-width": 1,
					"line-opacity": 0.15,
				},
			});
		}

		// Comuna fill for selected comunas
		if (!map.getLayer("comunas-fill")) {
			map.addLayer({
				id: "comunas-fill",
				type: "fill",
				source: "comunas-rm",
				paint: {
					"fill-color": "#ffffff",
					"fill-opacity": [
						"case",
						["in", ["get", "Comuna"], ["literal", selectedComunas]],
						0.12,
						0,
					],
				},
			});
		}

		if (fieldConfig.enabled && !map.getLayer("aqi-field")) {
			map.addLayer(createAqiFieldLayer());
		}
	}, [selectedComunas]);

	// Re-add layers after style changes
	useEffect(() => {
		if (!mapReady) return;
		const map = mapRef.current?.getMap();
		if (!map) return;

		const handleStyleData = () => {
			if (!map.getSource("comunas-rm")) {
				map.addSource("comunas-rm", {
					type: "geojson",
					data: {
						type: "FeatureCollection",
						features: comunasRM.map((c) => ({
							type: "Feature" as const,
							properties: { Comuna: c.name },
							geometry: {
								type: "Polygon" as const,
								coordinates: c.coords,
							},
						})),
					},
				});
			}
			if (!map.getLayer("comunas-line")) {
				map.addLayer({
					id: "comunas-line",
					type: "line",
					source: "comunas-rm",
					paint: {
						"line-color": "#ffffff",
						"line-width": 1,
						"line-opacity": 0.15,
					},
				});
			}
			if (!map.getLayer("comunas-fill")) {
				map.addLayer({
					id: "comunas-fill",
					type: "fill",
					source: "comunas-rm",
					paint: {
						"fill-color": "#ffffff",
						"fill-opacity": [
							"case",
							["in", ["get", "Comuna"], ["literal", selectedComunas]],
							0.12,
							0,
						],
					},
				});
			}
			if (fieldConfig.enabled && !map.getLayer("aqi-field")) {
				map.addLayer(createAqiFieldLayer());
			}
		};

		map.on("styledata", handleStyleData);
		return () => {
			map.off("styledata", handleStyleData);
		};
	}, [mapReady, selectedComunas]);

	// Sync heatmap visibility
	useEffect(() => {
		fieldConfig.enabled = showHeatmap;
		if (!mapReady) return;
		const map = mapRef.current?.getMap();
		if (!map) return;
		if (showHeatmap) {
			if (!map.getLayer("aqi-field")) {
				map.addLayer(createAqiFieldLayer());
			}
		} else {
			if (map.getLayer("aqi-field")) {
				map.removeLayer("aqi-field");
			}
		}
		map.triggerRepaint();
	}, [showHeatmap, mapReady]);

	// Sync selected comunas to custom layer + map fill layer
	useEffect(() => {
		fieldConfig.selectedComunas = selectedComunas;
		if (!mapReady) return;
		const map = mapRef.current?.getMap();
		if (!map) return;
		if (map.getLayer("comunas-fill")) {
			map.setPaintProperty("comunas-fill", "fill-opacity", [
				"case",
				["in", ["get", "Comuna"], ["literal", selectedComunas]],
				0.12,
				0,
			]);
		}
		map.triggerRepaint();
	}, [selectedComunas, mapReady]);

	// Click to select comuna
	useEffect(() => {
		const map = mapRef.current?.getMap();
		if (!map) return;

		const handleClick = (e: maplibregl.MapMouseEvent) => {
			if (!isSelectingRegion) return;
			const features = map.queryRenderedFeatures(e.point, {
				layers: ["comunas-fill"],
			});
			const first = features[0];
			if (first) {
				// biome-ignore lint/suspicious/noExplicitAny: GeoJSON property is dynamic
				const name = (first.properties as any).Comuna as string;
				if (name) onToggleComuna(name);
			}
		};

		map.on("click", handleClick);
		return () => {
			map.off("click", handleClick);
		};
	}, [isSelectingRegion, onToggleComuna]);

	// Cursor when selecting
	useEffect(() => {
		const map = mapRef.current?.getMap();
		if (!map) return;
		map.getCanvas().style.cursor = isSelectingRegion ? "pointer" : "";
	}, [isSelectingRegion]);

	// Manage station markers
	useEffect(() => {
		const map = mapRef.current?.getMap();
		if (!map) return;

		for (const marker of markersRef.current) {
			marker.remove();
		}
		markersRef.current = [];

		if (showStations) {
			for (let i = 0; i < mockStations.length; i++) {
				const station = mockStations[i];
				if (!station) continue;
				const el = document.createElement("div");
				const color = getAqiColor(station.aqi.value);
				const editStyle = isEditMode
					? "border-style: dashed; cursor: grab;"
					: "cursor: pointer;";
				el.style.cssText = `
					width: 32px;
					height: 32px;
					border-radius: 50%;
					background: ${color};
					color: white;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 11px;
					font-weight: 700;
					border: 2px solid white;
					box-shadow: 0 2px 6px rgba(0,0,0,0.25);
					font-family: Manrope, sans-serif;
					${editStyle}
				`;
				el.textContent = String(station.aqi.value);

				const marker = new maplibregl.Marker({
					element: el,
					anchor: "center",
					draggable: isEditMode,
				})
					.setLngLat([station.longitude, station.latitude])
					.addTo(map);

				if (isEditMode) {
					marker.on("drag", () => {
						const lngLat = marker.getLngLat();
						const fs = fieldStations[i];
						if (!fs) return;
						fs.lat = lngLat.lat;
						fs.lng = lngLat.lng;
						map.triggerRepaint();
					});
				}

				markersRef.current.push(marker);
			}
		}
	}, [showStations, isEditMode]);

	// Tooltip on mousemove
	useEffect(() => {
		const map = mapRef.current?.getMap();
		if (!map) return;

		const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
			const aqi = computeAqiAt(e.lngLat.lat, e.lngLat.lng);
			setTooltip({ x: e.point.x, y: e.point.y, aqi });
		};

		const handleMouseOut = () => {
			setTooltip(null);
		};

		map.on("mousemove", handleMouseMove);
		map.on("mouseout", handleMouseOut);

		return () => {
			map.off("mousemove", handleMouseMove);
			map.off("mouseout", handleMouseOut);
		};
	}, []);

	if (!isClient || !mapStyle) {
		return (
			<div className="flex h-full w-full items-center justify-center bg-gray-100">
				<p className="text-lg text-gray-600">Cargando mapa…</p>
			</div>
		);
	}

	return (
		<div className="relative h-full w-full">
			<MapLibreMap
				ref={mapRef}
				onLoad={handleMapLoad}
				initialViewState={{
					longitude: SANTIAGO.center.longitude,
					latitude: SANTIAGO.center.latitude,
					zoom: SANTIAGO.defaultZoom,
				}}
				style={{ width: "100%", height: "100%" }}
				mapStyle={mapStyle}
				maxBounds={SANTIAGO.bounds}
				minZoom={SANTIAGO.minZoom}
				dragPan={false}
				scrollZoom={false}
				doubleClickZoom={false}
				touchZoomRotate={false}
				dragRotate={false}
				keyboard={false}
				touchPitch={false}
			/>
			{tooltip && (
				<div
					className="pointer-events-none absolute z-30 rounded-lg border border-white/20 bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm"
					style={{
						left: tooltip.x + 12,
						top: tooltip.y - 36,
					}}
				>
					AQI: {tooltip.aqi}
				</div>
			)}
		</div>
	);
}
