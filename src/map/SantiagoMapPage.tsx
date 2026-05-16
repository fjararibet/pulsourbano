import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useState } from "react";
import { getComunasList, getDestinosDesdeComuna } from "#/map/server-od";
import { QuickSimulationPanel } from "#/simulation/QuickSimulationPanel";
import { DEFAULT_QUICK_SIMULATION_INPUT } from "#/simulation/quick-simulation";
import { DEFAULT_VISIBLE_LAYERS, LAYER_TOGGLES } from "./config";
import { MapLegend } from "./Legend";
import type { HoverInfo, LayerVisibility } from "./types";
import { useSantiagoMap } from "./use-santiago-map";

/**
 * Página principal: contenedor del mapa + panel lateral con toggles de capas,
 * info al hover y leyenda. Toda la lógica de MapLibre vive en `useSantiagoMap`.
 */
export function SantiagoMapPage() {
	const [visibleLayers, setVisibleLayers] = useState<LayerVisibility>(
		DEFAULT_VISIBLE_LAYERS,
	);
	const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null);
	const [simulationInput, setSimulationInput] = useState(
		DEFAULT_QUICK_SIMULATION_INPUT,
	);
	const [odMode, setOdMode] = useState(false);
	const [comunasList, setComunasList] = useState<string[]>([]);
	const [selectedOrigin, setSelectedOrigin] = useState("");
	const [odData, setOdData] = useState<Array<{
		comuna: string;
		trips: number;
	}> | null>(null);
	const [odLoading, setOdLoading] = useState(false);
	const { containerRef, resetView, clearPinned } = useSantiagoMap(
		visibleLayers,
		setHoverInfo,
		simulationInput,
		odData,
	);

	const activeLayerCount = Object.values(visibleLayers).filter(Boolean).length;

	const toggleLayer = (id: keyof LayerVisibility) =>
		setVisibleLayers((current) => ({ ...current, [id]: !current[id] }));

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") clearPinned();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [clearPinned]);

	useEffect(() => {
		getComunasList().then(setComunasList);
	}, []);

	useEffect(() => {
		if (!selectedOrigin) {
			setOdData(null);
			return;
		}
		setOdLoading(true);
		getDestinosDesdeComuna({ data: { comunaOrigen: selectedOrigin } })
			.then((results) => {
				setOdData(
					results.map((r) => ({
						comuna: r.destino ?? "",
						trips: r.total_viajes,
					})),
				);
			})
			.catch((err) => {
				console.error("OD query failed", err);
				setOdData(null);
			})
			.finally(() => setOdLoading(false));
	}, [selectedOrigin]);

	const showInfo = hoverInfo;
	const pinnedNote = showInfo?.pinned
		? "Fijado"
		: showInfo
			? "Click para fijar"
			: null;

	return (
		<main className="relative h-[100svh] w-full overflow-hidden bg-[#edf4e8] text-[#102f37]">
			<div className="absolute inset-0 z-0">
				<div ref={containerRef} className="h-full w-full" />
			</div>

			<section className="pointer-events-none absolute left-3 top-3 z-10 w-[min(360px,calc(100vw-24px))] sm:left-5 sm:top-5">
				<div className="pointer-events-auto max-h-[calc(100svh-24px)] overflow-y-auto overscroll-contain rounded-[28px] border border-white/70 bg-white/82 p-4 shadow-[0_24px_70px_rgba(16,47,55,0.18)] backdrop-blur-xl sm:max-h-[calc(100svh-40px)] sm:p-5">
					<header className="mb-4 flex items-start justify-between gap-3">
						<div>
							<p className="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-[#168a76]">
								Mapa de movilidad
							</p>
							<h1 className="m-0 mt-1 text-2xl font-black tracking-[-0.04em] text-[#102f37]">
								SimSantiago
							</h1>
						</div>
						<button
							type="button"
							onClick={resetView}
							className="rounded-full border border-[#b9d7d1] bg-white/80 px-3 py-1.5 text-xs font-bold text-[#24525b] shadow-sm transition hover:-translate-y-0.5 hover:border-[#5bb6a6] hover:bg-white"
						>
							Reset vista
						</button>
					</header>

					<p className="mb-4 text-sm leading-5 text-[#42656b]">
						Prende o apaga capas para leer la red. Pasa el cursor sobre
						estaciones, líneas y ciclovías para ver detalles sin llenar el mapa
						de texto.
					</p>

					<div className="grid gap-2">
						{LAYER_TOGGLES.map((layer) => {
							const active = visibleLayers[layer.id];
							return (
								<button
									key={layer.id}
									type="button"
									aria-pressed={active}
									onClick={() => toggleLayer(layer.id)}
									className={
										active
											? "flex items-center gap-3 rounded-2xl border border-[#b7dcd4] bg-[#effaf5] px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5"
											: "flex items-center gap-3 rounded-2xl border border-[#d9e7e4] bg-white/58 px-3 py-2.5 text-left opacity-60 transition hover:-translate-y-0.5 hover:opacity-90"
									}
								>
									<span
										className="h-4 w-4 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(16,47,55,0.14)]"
										style={{ backgroundColor: layer.color }}
									/>
									<span className="min-w-0">
										<span className="block text-sm font-black text-[#102f37]">
											{layer.label}
										</span>
										<span className="block truncate text-xs text-[#5b777c]">
											{layer.description}
										</span>
									</span>
									<span className="ml-auto text-xs font-black uppercase tracking-[0.14em] text-[#2a7f72]">
										{active ? "ON" : "OFF"}
									</span>
								</button>
							);
						})}
					</div>

					<div className="mt-4 rounded-2xl border border-[#d9e7e4] bg-white/72 p-3">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-[#5b777c]">
									Origen-Destino
								</p>
								<p className="m-0 mt-0.5 text-sm font-black text-[#102f37]">
									Viajes más frecuentes
								</p>
							</div>
							<button
								type="button"
								onClick={() => {
									setOdMode((v) => {
										if (v) {
											setSelectedOrigin("");
											setOdData(null);
										}
										return !v;
									});
								}}
								className={
									odMode
										? "rounded-full border border-[#168a76] bg-[#effaf5] px-3 py-1 text-xs font-black text-[#168a76] shadow-sm transition hover:-translate-y-0.5"
										: "rounded-full border border-[#d9e7e4] bg-white/58 px-3 py-1 text-xs font-black text-[#5b777c] opacity-60 shadow-sm transition hover:-translate-y-0.5 hover:opacity-90"
								}
							>
								{odMode ? "ON" : "OFF"}
							</button>
						</div>
						{odMode && (
							<div className="mt-2">
								<select
									value={selectedOrigin}
									onChange={(e) => setSelectedOrigin(e.target.value)}
									className="w-full rounded-xl border border-[#b9d7d1] bg-white px-3 py-2 text-sm text-[#102f37] outline-none ring-0 focus:border-[#5bb6a6]"
								>
									<option value="">Selecciona comuna origen…</option>
									{comunasList.map((c) => (
										<option key={c} value={c}>
											{c}
										</option>
									))}
								</select>
								{odLoading && (
									<p className="mt-2 text-xs text-[#5b777c]">
										Cargando viajes…
									</p>
								)}
								{!odLoading && odData && odData.length > 0 && (
									<p className="mt-2 text-xs text-[#5b777c]">
										{odData.length} destinos · máx:{" "}
										{Math.round(odData[0]?.trips ?? 0).toLocaleString("es-CL")}{" "}
										viajes
									</p>
								)}
							</div>
						)}
					</div>

					<QuickSimulationPanel
						input={simulationInput}
						onInputChange={setSimulationInput}
					/>

					<div className="mt-4 rounded-2xl border border-[#d9e7e4] bg-white/72 p-3">
						{showInfo ? (
							<div className="flex gap-3">
								<span
									className="mt-1 h-3 w-3 shrink-0 rounded-full"
									style={{ backgroundColor: showInfo.accent }}
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-2">
										<div>
											<p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-[#5b777c]">
												{showInfo.kind}
											</p>
											<p className="m-0 mt-0.5 text-sm font-black text-[#102f37]">
												{showInfo.title}
											</p>
											<p className="m-0 mt-1 break-words text-xs leading-4 text-[#5b777c]">
												{showInfo.description}
											</p>
										</div>
										{showInfo.pinned && (
											<button
												type="button"
												onClick={clearPinned}
												className="ml-2 shrink-0 rounded-full border border-[#c2d5d8] bg-white/80 p-1.5 text-[10px] font-bold text-[#24525b] shadow-sm transition hover:-translate-y-0.5 hover:border-[#5bb6a6] hover:bg-white"
												aria-label="Cerrar detalle"
											>
												✕
											</button>
										)}
									</div>
									{showInfo.details?.length ? (
										<div className="mt-2 grid gap-1.5">
											{showInfo.details.map((detail) => (
												<p
													key={detail}
													className="m-0 rounded-xl bg-[#f5faf7] px-2.5 py-1.5 text-xs font-semibold leading-4 break-words text-[#315a61]"
												>
													{detail}
												</p>
											))}
										</div>
									) : null}
									{showInfo.note ? (
										<p className="m-0 mt-2 text-[11px] font-semibold leading-4 text-[#5b777c]">
											{showInfo.note}
										</p>
									) : null}
									{pinnedNote ? (
										<p className="m-0 mt-2 text-[11px] font-semibold leading-4 text-[#789197]">
											{pinnedNote}
										</p>
									) : null}
								</div>
							</div>
						) : (
							<p className="m-0 text-xs leading-4 text-[#5b777c]">
								{activeLayerCount} de {LAYER_TOGGLES.length} capas activas.
								Explora pasando el cursor sobre la red.
							</p>
						)}
					</div>
				</div>
			</section>

			<MapLegend />
		</main>
	);
}
