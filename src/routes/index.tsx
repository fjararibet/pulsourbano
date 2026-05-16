import {
	createFileRoute,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { useRef, useCallback } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import CityMap from "../components/CityMap";
import AirQualityPanel from "../components/AirQualityPanel";
import type { Station } from "#/lib/air-quality-types";

function App() {
	const navigate = useNavigate();
	const search = useRouterState({ select: (s) => s.location.search });
	const panelOpen =
		typeof search === "object" && search
			? Boolean((search as Record<string, unknown>).aq)
			: false;
	const mapRef = useRef<MapRef | null>(null);

	const handleClosePanel = () => navigate({ to: "/", search: {} });

	const handleFlyTo = useCallback((station: Station) => {
		mapRef.current?.flyTo({
			center: [station.longitude, station.latitude],
			zoom: 14,
			duration: 1500,
		});
	}, []);

	return (
		<div className="relative h-[calc(100dvh-3.5rem)] w-full">
			<CityMap
				onMapRef={(ref) => {
					mapRef.current = ref;
				}}
			/>
			<AirQualityPanel
				isOpen={panelOpen}
				onClose={handleClosePanel}
				onFlyTo={handleFlyTo}
			/>
		</div>
	);
}

export const Route = createFileRoute("/")({ component: App });
