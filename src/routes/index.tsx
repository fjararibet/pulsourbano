import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import AqiLegend from "../components/AqiLegend";
import CityMap from "../components/CityMap";

function App() {
	const [showStations, setShowStations] = useState(false);

	return (
		<div className="relative h-dvh w-full">
			<CityMap showStations={showStations} />
			<AqiLegend
				showStations={showStations}
				onToggleStations={() => setShowStations((v) => !v)}
			/>
		</div>
	);
}

export const Route = createFileRoute("/")({ component: App });
