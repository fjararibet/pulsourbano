import { useEffect, useState, useRef } from "react";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchCustomStyle } from "#/lib/map-style";
import HeatmapOverlay from "./HeatmapOverlay";

const SANTIAGO = {
	center: { longitude: -70.6693, latitude: -33.4489 },
	bounds: [-70.85, -33.65, -70.45, -33.25] as [number, number, number, number],
	minZoom: 10,
	defaultZoom: 12,
};

interface CityMapProps {
	onMapRef?: (ref: MapRef | null) => void;
}

export default function CityMap({ onMapRef }: CityMapProps) {
	const [isClient, setIsClient] = useState(false);
	const [mapStyle, setMapStyle] = useState<any>(null);
	const [viewState, setViewState] = useState({
		longitude: SANTIAGO.center.longitude,
		latitude: SANTIAGO.center.latitude,
		zoom: SANTIAGO.defaultZoom,
	});
	const mapRef = useRef<MapRef | null>(null);

	useEffect(() => {
		setIsClient(true);
		fetchCustomStyle().then(setMapStyle);
	}, []);

	useEffect(() => {
		if (mapRef.current) {
			onMapRef?.(mapRef.current);
		}
	}, [onMapRef]);

	if (!isClient || !mapStyle) {
		return (
			<div className="flex h-full w-full items-center justify-center bg-gray-100">
				<p className="text-lg text-gray-600">Cargando mapa...</p>
			</div>
		);
	}

	return (
		<div className="relative h-full w-full">
			<MapLibreMap
				ref={mapRef}
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
				onMove={(evt) => {
					setViewState({
						longitude: evt.viewState.longitude,
						latitude: evt.viewState.latitude,
						zoom: evt.viewState.zoom,
					});
				}}
			/>
			<HeatmapOverlay
				longitude={viewState.longitude}
				latitude={viewState.latitude}
				zoom={viewState.zoom}
			/>
		</div>
	);
}
