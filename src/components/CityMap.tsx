import { useEffect, useState } from "react";
import {
	Map as MapLibreMap,
	NavigationControl,
	FullscreenControl,
	GeolocateControl,
	ScaleControl,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const SANTIAGO_VIEW_STATE = {
	longitude: -70.6693,
	latitude: -33.4489,
	zoom: 12,
};

export default function CityMap() {
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
	}, []);

	if (!isClient) {
		return (
			<div className="flex h-full w-full items-center justify-center bg-gray-100">
				<p className="text-lg text-gray-600">Cargando mapa...</p>
			</div>
		);
	}

	return (
		<div className="h-full w-full">
			<MapLibreMap
				initialViewState={SANTIAGO_VIEW_STATE}
				style={{ width: "100%", height: "100%" }}
				mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
			>
				<NavigationControl position="top-right" />
				<FullscreenControl position="top-right" />
				<GeolocateControl position="top-right" />
				<ScaleControl position="bottom-left" />
			</MapLibreMap>
		</div>
	);
}
