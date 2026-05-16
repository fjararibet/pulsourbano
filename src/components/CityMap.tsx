import { useCallback, useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { mockStations } from "#/lib/air-quality-mock";
import { getAqiColor } from "#/lib/air-quality-types";
import { computeAqiAt } from "#/lib/aqi-field";
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
}

interface TooltipData {
	x: number;
	y: number;
	aqi: number;
}

export default function CityMap({ showStations }: CityMapProps) {
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
		console.log("[AQI] MapLibreMap onLoad fired");
		const map = mapRef.current?.getMap();
		if (!map) {
			console.warn("[AQI] mapRef.current is null in onLoad");
			return;
		}
		if (!map.getLayer("aqi-field")) {
			console.log("[AQI] adding custom layer from onLoad");
			map.addLayer(createAqiFieldLayer());
		}
		setMapReady(true);
	}, []);

	// Add / re-add custom AQI field layer whenever style changes (after map is ready)
	useEffect(() => {
		if (!mapReady) return;
		const map = mapRef.current?.getMap();
		if (!map) return;

		const handleStyleData = () => {
			console.log("[AQI] styledata event — checking layer");
			if (!map.getLayer("aqi-field")) {
				console.log("[AQI] adding custom layer after styledata");
				map.addLayer(createAqiFieldLayer());
			}
		};

		map.on("styledata", handleStyleData);

		return () => {
			map.off("styledata", handleStyleData);
		};
	}, [mapReady]);

	// Manage station markers
	useEffect(() => {
		const map = mapRef.current?.getMap();
		if (!map) return;

		for (const marker of markersRef.current) {
			marker.remove();
		}
		markersRef.current = [];

		if (showStations) {
			for (const station of mockStations) {
				const el = document.createElement("div");
				const color = getAqiColor(station.aqi.value);
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
					cursor: pointer;
					font-family: Manrope, sans-serif;
				`;
				el.textContent = String(station.aqi.value);

				const marker = new maplibregl.Marker({
					element: el,
					anchor: "center",
				})
					.setLngLat([station.longitude, station.latitude])
					.addTo(map);

				markersRef.current.push(marker);
			}
		}
	}, [showStations]);

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
				dragRotate={false}
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
