import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import AqiLegend from "../components/AqiLegend";
import CityMap from "../components/CityMap";

function App() {
	const [showStations, setShowStations] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [showHeatmap, setShowHeatmap] = useState(true);
	const [isSelectingRegion, setIsSelectingRegion] = useState(false);
	const [selectedBounds, setSelectedBounds] = useState<{
		south: number;
		north: number;
		west: number;
		east: number;
	} | null>(null);

	return (
		<div className="relative h-dvh w-full">
			<CityMap
				showStations={showStations}
				isEditMode={isEditMode}
				showHeatmap={showHeatmap}
				isSelectingRegion={isSelectingRegion}
				selectedBounds={selectedBounds}
				onSelectRegion={setSelectedBounds}
			/>
			<AqiLegend
				showStations={showStations}
				onToggleStations={() => setShowStations((v) => !v)}
				isEditMode={isEditMode}
				onToggleEditMode={() => setIsEditMode((v) => !v)}
				showHeatmap={showHeatmap}
				onToggleHeatmap={() => setShowHeatmap((v) => !v)}
				isSelectingRegion={isSelectingRegion}
				onToggleSelectRegion={() => setIsSelectingRegion((v) => !v)}
				hasSelectedRegion={!!selectedBounds}
				onClearRegion={() => setSelectedBounds(null)}
			/>
		</div>
	);
}

export const Route = createFileRoute("/")({ component: App });
