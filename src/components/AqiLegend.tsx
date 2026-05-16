import { useMemo, useState } from "react";
import { getAqiColor } from "#/lib/air-quality-types";
import { comunasRM } from "#/lib/comunas-rm";

interface AqiLegendProps {
	showStations: boolean;
	onToggleStations: () => void;
	isEditMode: boolean;
	onToggleEditMode: () => void;
	showHeatmap: boolean;
	onToggleHeatmap: () => void;
	isSelectingRegion: boolean;
	onToggleSelectRegion: () => void;
	selectedComunas: string[];
	onToggleComuna: (name: string) => void;
	onClearComunas: () => void;
}

const LEVELS = [
	{ min: 0, max: 50, label: "Bueno" },
	{ min: 51, max: 100, label: "Moderado" },
	{ min: 101, max: 150, label: "Sensibles" },
	{ min: 151, max: 200, label: "Dañino" },
	{ min: 201, max: 300, label: "Muy dañino" },
	{ min: 301, max: 500, label: "Peligroso" },
];

export default function AqiLegend({
	showStations,
	onToggleStations,
	isEditMode,
	onToggleEditMode,
	showHeatmap,
	onToggleHeatmap,
	isSelectingRegion,
	onToggleSelectRegion,
	selectedComunas,
	onToggleComuna,
	onClearComunas,
}: AqiLegendProps) {
	const [search, setSearch] = useState("");

	const suggestions = useMemo(() => {
		if (!search.trim()) return [];
		const q = search.toLowerCase();
		return comunasRM
			.map((c) => c.name)
			.filter((name) => name.toLowerCase().includes(q))
			.slice(0, 6);
	}, [search]);

	return (
		<div className="pointer-events-auto absolute bottom-5 left-5 z-20 flex flex-col gap-2">
			<div className="rounded-xl border border-white/15 bg-black/35 px-4 py-3 shadow-lg backdrop-blur-md">
				<div className="mb-2 flex items-center justify-between gap-4">
					<p className="text-[11px] font-semibold uppercase tracking-wide text-white/90">
						Calidad del Aire
					</p>
					<div className="flex gap-1.5">
						<button
							onClick={onToggleHeatmap}
							className="rounded-md bg-white/15 px-2 py-1 text-[10px] font-semibold text-white/90 transition hover:bg-white/25"
							type="button"
						>
							Campo {showHeatmap ? "ON" : "OFF"}
						</button>
						<button
							onClick={onToggleStations}
							className="rounded-md bg-white/15 px-2 py-1 text-[10px] font-semibold text-white/90 transition hover:bg-white/25"
							type="button"
						>
							Estaciones {showStations ? "ON" : "OFF"}
						</button>
						{showStations && (
							<button
								onClick={onToggleEditMode}
								className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
									isEditMode
										? "bg-lime-500/80 text-white hover:bg-lime-500"
										: "bg-white/15 text-white/90 hover:bg-white/25"
								}`}
								type="button"
							>
								{isEditMode ? "Editando" : "Editar"}
							</button>
						)}
					</div>
				</div>

				<div className="mb-2 flex items-center gap-1.5">
					<button
						onClick={onToggleSelectRegion}
						className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
							isSelectingRegion
								? "bg-lime-500/80 text-white hover:bg-lime-500"
								: "bg-white/15 text-white/90 hover:bg-white/25"
						}`}
						type="button"
					>
						{isSelectingRegion ? "Seleccionando…" : "Seleccionar comunas"}
					</button>
					{selectedComunas.length > 0 && (
						<button
							onClick={onClearComunas}
							className="rounded-md bg-white/15 px-2 py-1 text-[10px] font-semibold text-white/90 transition hover:bg-white/25"
							type="button"
						>
							Limpiar
						</button>
					)}
				</div>

				<div className="relative mb-2">
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Buscar comuna…"
						className="w-full rounded-md bg-white/10 px-2 py-1 text-[11px] text-white placeholder:text-white/40 outline-none ring-0 focus:bg-white/20"
					/>
					{suggestions.length > 0 && (
						<div className="absolute bottom-full left-0 z-30 mb-1 w-full overflow-hidden rounded-md border border-white/10 bg-black/70 shadow-lg backdrop-blur-md">
							{suggestions.map((name) => (
								<button
									key={name}
									onClick={() => {
										onToggleComuna(name);
										setSearch("");
									}}
									className={`w-full px-2 py-1 text-left text-[11px] transition ${
										selectedComunas.includes(name)
											? "bg-lime-500/40 text-white"
											: "text-white/90 hover:bg-white/15"
									}`}
									type="button"
								>
									{name}
									{selectedComunas.includes(name) && (
										<span className="ml-1 text-[9px]">✓</span>
									)}
								</button>
							))}
						</div>
					)}
				</div>

				{selectedComunas.length > 0 && (
					<div className="mb-2 flex flex-wrap gap-1">
						{selectedComunas.map((name) => (
							<button
								key={name}
								onClick={() => onToggleComuna(name)}
								className="flex items-center gap-1 rounded-full bg-lime-500/30 px-2 py-0.5 text-[10px] text-white transition hover:bg-lime-500/50"
								type="button"
							>
								{name}
								<span className="text-white/70">×</span>
							</button>
						))}
					</div>
				)}

				<div className="flex h-2 overflow-hidden rounded-full">
					{LEVELS.map((level) => (
						<div
							key={level.label}
							className="flex-1"
							style={{
								backgroundColor: getAqiColor((level.min + level.max) / 2),
							}}
						/>
					))}
				</div>
				<div className="mt-1.5 flex justify-between">
					{LEVELS.map((level) => (
						<div key={level.label} className="flex-1 text-center">
							<span className="block text-[9px] font-bold text-white/90">
								{level.min}–{level.max}
							</span>
							<span className="block text-[9px] text-white/70">
								{level.label}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
