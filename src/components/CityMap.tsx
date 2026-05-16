import { useCallback, useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { mockStations } from "#/lib/air-quality-mock";
import { getAqiColor } from "#/lib/air-quality-types";
import { computeAqiAt, fieldConfig, fieldStations } from "#/lib/aqi-field";
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
	selectedBounds: {
		south: number;
		north: number;
		west: number;
		east: number;
	} | null;
	onSelectRegion: (
		bounds: { south: number; north: number; west: number; east: number } | null,
	) => void;
}

interface TooltipData {
	x: number;
	y: number;
	aqi: number;
}

interface Rect {
	start: { x: number; y: number };
	end: { x: number; y: number };
}

export default function CityMap({
	showStations,
	isEditMode,
	showHeatmap,
	isSelectingRegion,
	selectedBounds,
	onSelectRegion,
}: CityMapProps) {
	const [isClient, setIsClient] = useState(false);
	// biome-ignore lint/suspicious/noExplicitAny: style JSON is dynamic
	const [mapStyle, setMapStyle] = useState<any>(null);
	const [mapReady, setMapReady] = useState(false);
	const [tooltip, setTooltip] = useState<TooltipData | null>(null);
	const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
	const mapRef = useRef<MapRef | null>(null);
	const markersRef = useRef<maplibregl.Marker[]>([]);
	const isDraggingRef = useRef(false);
	const selectionRef = useRef<Rect | null>(null);

	useEffect(() => {
		setIsClient(true);
		fetchCustomStyle().then(setMapStyle);
	}, []);

	const handleMapLoad = useCallback(() => {
		const map = mapRef.current?.getMap();
		if (!map) return;
		setMapReady(true);
		if (fieldConfig.enabled && !map.getLayer("aqi-field")) {
			map.addLayer(createAqiFieldLayer());
		}
	}, []);

	// Re-add custom AQI field layer whenever style changes (after map is ready)
	useEffect(() => {
		if (!mapReady) return;
		const map = mapRef.current?.getMap();
		if (!map) return;

		const handleStyleData = () => {
			if (!fieldConfig.enabled) return;
			if (!map.getLayer("aqi-field")) {
				map.addLayer(createAqiFieldLayer());
			}
		};

		map.on("styledata", handleStyleData);

		return () => {
			map.off("styledata", handleStyleData);
		};
	}, [mapReady]);

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

	// Sync selected bounds
	useEffect(() => {
		fieldConfig.bounds = selectedBounds;
		if (!mapReady) return;
		const map = mapRef.current?.getMap();
		if (map) map.triggerRepaint();
	}, [selectedBounds, mapReady]);

	// Manage selection mode (disable pan)
	useEffect(() => {
		const map = mapRef.current?.getMap();
		if (!map) return;
		if (isSelectingRegion) {
			map.dragPan.disable();
		} else {
			map.dragPan.enable();
			isDraggingRef.current = false;
			selectionRef.current = null;
			setSelectionRect(null);
		}
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

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!isSelectingRegion) return;
			e.currentTarget.setPointerCapture(e.pointerId);
			isDraggingRef.current = true;
			const rect = {
				start: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
				end: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
			};
			selectionRef.current = rect;
			setSelectionRect(rect);
		},
		[isSelectingRegion],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!isDraggingRef.current) return;
			const rect = selectionRef.current;
			if (!rect) return;
			const updated = {
				...rect,
				end: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
			};
			selectionRef.current = updated;
			setSelectionRect(updated);
		},
		[],
	);

	const handlePointerUp = useCallback(() => {
		if (!isDraggingRef.current) return;
		isDraggingRef.current = false;
		const rect = selectionRef.current;
		selectionRef.current = null;
		setSelectionRect(null);

		const map = mapRef.current?.getMap();
		if (!map || !rect) return;

		const x1 = Math.min(rect.start.x, rect.end.x);
		const y1 = Math.min(rect.start.y, rect.end.y);
		const x2 = Math.max(rect.start.x, rect.end.x);
		const y2 = Math.max(rect.start.y, rect.end.y);

		const nw = map.unproject([x1, y1]);
		const se = map.unproject([x2, y2]);

		onSelectRegion({
			south: se.lat,
			north: nw.lat,
			west: nw.lng,
			east: se.lng,
		});
	}, [onSelectRegion]);

	const handlePointerCancel = useCallback(() => {
		isDraggingRef.current = false;
		selectionRef.current = null;
		setSelectionRect(null);
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
				dragRotate={false}
				touchPitch={false}
			/>
			{isSelectingRegion && (
				<div
					className="absolute inset-0 z-10 cursor-crosshair"
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={handlePointerCancel}
				/>
			)}
			{selectionRect && (
				<div
					className="pointer-events-none absolute z-10 border-2 border-dashed border-white bg-white/10"
					style={{
						left: Math.min(selectionRect.start.x, selectionRect.end.x),
						top: Math.min(selectionRect.start.y, selectionRect.end.y),
						width: Math.abs(selectionRect.end.x - selectionRect.start.x),
						height: Math.abs(selectionRect.end.y - selectionRect.start.y),
					}}
				/>
			)}
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
