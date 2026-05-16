import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import AqiLegend from "../components/AqiLegend";
import CityMap from "../components/CityMap";

function App() {
	const [showStations, setShowStations] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [showHeatmap, setShowHeatmap] = useState(true);
	const [isSelectingRegion, setIsSelectingRegion] = useState(false);
	const [selectedComunas, setSelectedComunas] = useState<string[]>([]);

	const handleToggleComuna = useCallback((name: string) => {
		setSelectedComunas((prev) =>
			prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
		);
	}, []);

	const handleClearComunas = useCallback(() => {
		setSelectedComunas([]);
	}, []);

	return (
		<div className="relative h-dvh w-full">
			<CityMap
				showStations={showStations}
				isEditMode={isEditMode}
				showHeatmap={showHeatmap}
				isSelectingRegion={isSelectingRegion}
				selectedComunas={selectedComunas}
				onToggleComuna={handleToggleComuna}
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
				selectedComunas={selectedComunas}
				onToggleComuna={handleToggleComuna}
				onClearComunas={handleClearComunas}
			/>
		</div>
	);
}

export const Route = createFileRoute("/")({ component: App });
