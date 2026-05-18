import { ChevronDown, ChevronUp } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { DESTINO_COLOR, ORIGEN_COLOR } from "./config";
import { MapLegend } from "./Legend";
import { clearODData, setODData } from "./layers";
import { NoiseGauge } from "./NoiseGauge";
import type { NoiseComunaStats } from "./noise";
import { getComunaOD } from "./server-comunas";
import type { HoverInfo } from "./types";
import { type SelectedNoiseStats, useSantiagoMap } from "./use-santiago-map";

const ROUTE_MODES = [
	{ key: "auto", label: "Auto", color: "#f59e0b" },
	{ key: "bus", label: "Bus", color: "#3b82f6" },
	{ key: "metro", label: "Metro", color: "#ef4444" },
	{ key: "bicycle", label: "No motorizado", color: "#10b981" },
] as const;

const EMPTY_NOISE_STATS: SelectedNoiseStats = { origen: null, destino: null };

export function SantiagoMapPage() {
	const [, setHoverInfo] = useState<HoverInfo>(null);
	const [mapReady, setMapReady] = useState(false);
	const [selections, setSelections] = useState<{
		origen: string | null;
		destino: string | null;
	}>({ origen: null, destino: null });
	const [showOD, setShowOD] = useState(false);
	const [isCollapsed, setIsCollapsed] = useState(true);
	const [showNoiseOverlay, setShowNoiseOverlay] = useState(false);
	const [selectedNoiseStats, setSelectedNoiseStats] =
		useState<SelectedNoiseStats>(EMPTY_NOISE_STATS);
	const mapRef = useRef<MapLibreMap | null>(null);
	const savedViewRef = useRef<{
		center: [number, number];
		zoom: number;
	} | null>(null);

	const handleSelectComuna = useCallback(
		(name: string) => {
			if (showOD && mapRef.current) {
				clearODData(mapRef.current);
				setShowOD(false);
			}
			setSelections((prev) => {
				if (prev.origen === name) return { origen: null, destino: null };
				if (prev.destino === name) return { ...prev, destino: null };
				if (!prev.origen) return { ...prev, origen: name };
				if (name === prev.origen) return prev;
				return { ...prev, destino: name };
			});
		},
		[showOD],
	);

	const clearSelections = useCallback(() => {
		setSelections({ origen: null, destino: null });
		setSelectedNoiseStats(EMPTY_NOISE_STATS);
	}, []);

	const { containerRef, clearPinned, resetView } = useSantiagoMap(
		setHoverInfo,
		{
			origen: selections.origen,
			destino: selections.destino,
			onSelectComuna: handleSelectComuna,
			showNoiseOverlay,
			onNoiseStatsChange: setSelectedNoiseStats,
			onMapReady: (map) => {
				mapRef.current = map;
				setMapReady(true);
			},
		},
	);

	const handleToggleOD = useCallback(() => {
		setShowOD((v) => {
			const next = !v;
			if (!next && mapRef.current) {
				clearODData(mapRef.current);
			}
			return next;
		});
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				savedViewRef.current = null;
				if (showOD && mapRef.current) {
					clearODData(mapRef.current);
				}
				setShowOD(false);
				clearPinned();
				clearSelections();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [clearPinned, clearSelections, showOD]);

	useEffect(() => {
		if (!showOD) return;
		const nombreComuna = selections.origen;
		if (!nombreComuna) return;
		const map = mapRef.current;
		if (!map) return;

		savedViewRef.current = {
			center: map.getCenter().toArray() as [number, number],
			zoom: map.getZoom(),
		};
		map.flyTo({
			center: [-70.6483, -33.4569],
			zoom: 10.5,
			duration: 800,
		});

		(
			getComunaOD as (opts: {
				data: { nombreComuna: string };
			}) => Promise<GeoJSON.FeatureCollection>
		)({
			data: { nombreComuna },
		})
			.then((geojson) => {
				if (mapRef.current) setODData(mapRef.current, geojson);
			})
			.catch(console.error);
	}, [showOD, selections.origen]);

	useEffect(() => {
		if (!selections.origen && !selections.destino) {
			setSelectedNoiseStats(EMPTY_NOISE_STATS);
			if (mapRef.current) {
				mapRef.current.flyTo({
					center: [-70.6483, -33.4569],
					zoom: 11,
					bearing: 0,
					pitch: 0,
					duration: 650,
				});
			}
			if (showOD) {
				setShowOD(false);
				if (mapRef.current) clearODData(mapRef.current);
			}
			return;
		}
	}, [selections.origen, selections.destino, showOD]);

	const hasSelection = Boolean(selections.origen || selections.destino);
	const activeNoiseDb = showNoiseOverlay
		? (selectedNoiseStats.destino?.dbPromedioComunal ??
			selectedNoiseStats.origen?.dbPromedioComunal ??
			null)
		: null;

	return (
		<main className="relative h-[100svh] w-full overflow-hidden bg-[#edf4e8] text-[#102f37]">
			<div className="absolute inset-0 z-0">
				<div ref={containerRef} className="h-full w-full" />
			</div>

			{!mapReady && (
				<div className="absolute inset-0 z-20 flex items-center justify-center bg-[#edf4e8]">
					<div className="flex flex-col items-center gap-3">
						<div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b9d7d1] border-t-[#24525b]" />
						<span className="text-sm font-medium text-[#5b777c]">
							Cargando mapa...
						</span>
					</div>
				</div>
			)}

			<div className="absolute top-2 right-2 z-20 flex overflow-hidden rounded-full border border-white/70 bg-white/90 shadow-lg backdrop-blur-xl sm:top-4 sm:right-4">
				<button
					type="button"
					aria-pressed={showNoiseOverlay}
					onClick={() => setShowNoiseOverlay((value) => !value)}
					className={`px-3 py-1.5 text-xs font-bold transition ${
						showNoiseOverlay
							? "bg-[#dc2626] text-white"
							: "text-[#5b777c] hover:bg-[#f1f7f4]"
					}`}
				>
					Ruido {showNoiseOverlay ? "ON" : "OFF"}
				</button>
			</div>

			<section className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex flex-col items-end gap-2 p-2 sm:pointer-events-auto sm:inset-y-0 sm:left-0 sm:right-auto sm:w-80 sm:items-start sm:overflow-y-auto sm:border-r sm:border-white/70 sm:bg-white/90 sm:p-4 sm:shadow-[4px_0_24px_rgba(16,47,55,0.1)] sm:backdrop-blur-xl">
				{hasSelection ? (
					<button
						type="button"
						onClick={() => {
							clearSelections();
							resetView();
						}}
						className="pointer-events-auto rounded-full border border-[#b9d7d1] bg-white/90 px-3 py-1.5 text-xs font-bold text-[#24525b] shadow-[0_8px_24px_rgba(16,47,55,0.18)] backdrop-blur transition hover:border-[#5bb6a6] hover:bg-white"
					>
						Reiniciar
					</button>
				) : null}

				<div className="pointer-events-auto w-full rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_-12px_40px_rgba(16,47,55,0.16)] backdrop-blur-xl sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none sm:backdrop-blur-none">
					<div className="flex w-full items-center gap-1.5 sm:hidden">
						<button
							type="button"
							onClick={() => setIsCollapsed((v) => !v)}
							className="flex min-w-0 flex-1 items-center gap-1.5"
							aria-label={isCollapsed ? "Expandir panel" : "Colapsar panel"}
						>
							<div className="flex min-w-0 flex-1 items-center gap-1.5">
								{selections.origen ? (
									<>
										<span
											className="h-2 w-2 shrink-0 rounded-full"
											style={{ backgroundColor: ORIGEN_COLOR }}
										/>
										<span className="truncate text-xs font-bold text-[#102f37]">
											{selections.origen}
										</span>
										{selections.destino ? (
											<>
												<span className="text-[10px] text-[#5b777c]">→</span>
												<span
													className="h-2 w-2 shrink-0 rounded-full"
													style={{ backgroundColor: DESTINO_COLOR }}
												/>
												<span className="truncate text-xs font-bold text-[#102f37]">
													{selections.destino}
												</span>
											</>
										) : (
											<span className="truncate text-[10px] text-[#5b777c]">
												→ elige destino
											</span>
										)}
									</>
								) : (
									<span className="text-xs font-medium text-[#5b777c]">
										Selecciona una comuna
									</span>
								)}
							</div>
						</button>
						{selections.origen && !selections.destino && (
							<button
								type="button"
								onClick={handleToggleOD}
								className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-tight transition ${
									showOD
										? "border-[#e67e22] bg-[#e67e22] text-white"
										: "border-[#b9d7d1] text-[#24525b] hover:border-[#e67e22]"
								}`}
							>
								Destinos regulares
							</button>
						)}
						<button
							type="button"
							onClick={() => setIsCollapsed((v) => !v)}
							className="shrink-0"
							aria-label={isCollapsed ? "Expandir panel" : "Colapsar panel"}
						>
							{isCollapsed ? (
								<ChevronUp className="h-4 w-4 text-[#5b777c]" />
							) : (
								<ChevronDown className="h-4 w-4 text-[#5b777c]" />
							)}
						</button>
					</div>
					<div
						className={`${isCollapsed ? "hidden" : "mt-2"} sm:mt-0 sm:block`}
					>
						{showNoiseOverlay ? (
							<div className="mb-3 flex items-center gap-3 sm:hidden">
								<NoiseGauge db={activeNoiseDb} compact />
								<div className="min-w-0">
									<p className="m-0 text-[9px] font-black uppercase tracking-[0.18em] text-[#5b777c]">
										Ruido dB(A)
									</p>
									<p className="m-0 mt-1 text-xs font-bold text-[#315a61]">
										{activeNoiseDb !== null
											? "Promedio de comuna seleccionada"
											: hasSelection
												? "Sin datos para la selección"
												: "Selecciona una comuna"}
									</p>
								</div>
							</div>
						) : null}

						{selections.origen && selections.destino ? (
							<div className="flex flex-col gap-2">
								<SelectedComunaLine
									label="Origen"
									name={selections.origen}
									color={ORIGEN_COLOR}
								/>
								<SelectedComunaLine
									label="Destino"
									name={selections.destino}
									color={DESTINO_COLOR}
								/>
								<NoiseSelectionSummary
									show={showNoiseOverlay}
									origen={selections.origen}
									destino={selections.destino}
									stats={selectedNoiseStats}
								/>
								<div className="mt-3 flex flex-col gap-1.5 border-t border-[#dce8e3] pt-3">
									<p className="m-0 text-[9px] font-black uppercase tracking-[0.18em] text-[#5b777c]">
										Rutas
									</p>
									{ROUTE_MODES.map((route) => (
										<div key={route.key} className="flex items-center gap-2">
											<span
												className="h-1 w-8 shrink-0 rounded-full"
												style={{ backgroundColor: route.color }}
											/>
											<span className="text-xs font-semibold text-[#102f37]">
												{route.label}
											</span>
										</div>
									))}
								</div>
							</div>
						) : selections.origen ? (
							<div className="flex flex-col gap-2">
								<div className="flex items-center gap-2">
									<span
										className="h-3 w-3 shrink-0 rounded-full"
										style={{ backgroundColor: ORIGEN_COLOR }}
									/>
									<span className="text-sm font-bold text-[#102f37]">
										{selections.origen}
									</span>
									<button
										type="button"
										onClick={handleToggleOD}
										className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-sm font-bold transition sm:inline-flex ${
											showOD
												? "border-[#e67e22] bg-[#e67e22] text-white"
												: "border-[#b9d7d1] text-[#24525b] hover:border-[#e67e22]"
										}`}
									>
										Destinos regulares
									</button>
									<button
										type="button"
										onClick={() =>
											setSelections((p) => ({
												...p,
												origen: null,
												destino: null,
											}))
										}
										className="ml-auto shrink-0 rounded-full p-1 text-[10px] font-bold text-[#5b777c] transition hover:bg-[#eef4f1] hover:text-[#24525b]"
										aria-label="Quitar origen"
									>
										x
									</button>
								</div>
								<NoiseSelectionSummary
									show={showNoiseOverlay}
									origen={selections.origen}
									destino={null}
									stats={selectedNoiseStats}
								/>
								<p className="m-0 text-center text-xs font-medium text-[#5b777c]">
									Selecciona una comuna de destino
								</p>
							</div>
						) : (
							<p className="m-0 text-center text-xs font-medium text-[#5b777c]">
								Selecciona una comuna de origen
							</p>
						)}
					</div>
				</div>
			</section>

			<MapLegend showNoiseOverlay={showNoiseOverlay} noiseDb={activeNoiseDb} />
		</main>
	);
}

function SelectedComunaLine({
	label,
	name,
	color,
}: {
	label: string;
	name: string;
	color: string;
}) {
	return (
		<div className="flex items-center gap-2">
			<span
				className="h-3 w-3 shrink-0 rounded-full"
				style={{ backgroundColor: color }}
			/>
			<span className="text-sm font-bold text-[#102f37]">
				{label}: {name}
			</span>
		</div>
	);
}

function NoiseSelectionSummary({
	show,
	origen,
	destino,
	stats,
}: {
	show: boolean;
	origen: string | null;
	destino: string | null;
	stats: SelectedNoiseStats;
}) {
	if (!show) return null;

	return (
		<div className="mt-3 rounded-2xl border border-red-100 bg-red-50/70 p-2.5">
			<p className="m-0 text-[9px] font-black uppercase tracking-[0.18em] text-red-700">
				Ruido ambiental
			</p>
			<div className="mt-2 flex flex-col gap-1.5">
				{origen ? (
					<NoiseStatRow label="Origen" name={origen} stat={stats.origen} />
				) : null}
				{destino ? (
					<NoiseStatRow label="Destino" name={destino} stat={stats.destino} />
				) : null}
			</div>
		</div>
	);
}

function NoiseStatRow({
	label,
	name,
	stat,
}: {
	label: string;
	name: string;
	stat: NoiseComunaStats | null;
}) {
	return (
		<div className="flex items-start gap-2 rounded-xl bg-white/70 px-2 py-1.5">
			<span
				className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
				style={{ backgroundColor: stat?.accent ?? "#9ca3af" }}
			/>
			<div className="min-w-0">
				<p className="m-0 truncate text-xs font-black text-[#102f37]">
					{label}: {name}
				</p>
				<p className="m-0 text-[11px] font-semibold text-[#5b777c]">
					{stat
						? `${stat.dbPromedioComunal.toFixed(1)} dB(A) promedio · rango ${stat.dbMinComunal}-${stat.dbMaxComunal}`
						: "Sin datos de ruido para esta comuna"}
				</p>
			</div>
		</div>
	);
}
