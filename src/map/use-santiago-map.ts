import type { Map as MapLibreMap } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef } from "react";
import type { ModoRow } from "#/lib/comparador/comparador-types";
import {
	type CostingMode,
	getRoute,
	precomputePairRoutes,
} from "#/lib/route-store";
import {
	type ArrowHandle,
	type ArrowMapLibreManager,
	type ArrowStyle,
	createArrowMapLibreManager,
} from "./arrow-maplibre";
import {
	BASE_STYLE,
	COMUNA_ALL_LAYER_IDS,
	COMUNA_BASE_LAYER_IDS,
	COMUNA_ZOOM,
	INITIAL_ZOOM,
	MAP_DETAIL_BEARING,
	MAP_DETAIL_PITCH,
	NOISE_ALL_LAYER_IDS,
	NOISE_OVERLAY_LAYER_IDS,
	SANTIAGO_CENTER,
} from "./config";
import {
	type HoverPinController,
	setupComunaDualSelect,
	setupComunaHover,
} from "./hover";
import {
	addComunaLayers,
	addNoiseComunaLayers,
	addNoiseLayers,
	addODLayers,
	addRouteArrowLayers,
	bringComunaHoverToFront,
	bringRouteArrowToFront,
	clearRouteArrow,
	updateComunaSelectionLayers,
	updateNoiseSelectionLayers,
} from "./layers";
import {
	buildNoiseComunaFeatures,
	buildNoiseComunaStats,
	getNoiseComunaStats,
	type NoiseComunaStats,
	type NoiseComunaStatsRecord,
} from "./noise";
import { getComunasGeoJSON } from "./server-comunas";
import type { HoverInfo } from "./types";
import { getPolygonCentroid, loadJSON } from "./utils";

export type SelectedNoiseStats = {
	origen: NoiseComunaStats | null;
	destino: NoiseComunaStats | null;
};

type DualSelect = {
	origen: string | null;
	destino: string | null;
	onSelectComuna: (name: string) => void;
	showNoiseOverlay?: boolean;
	onNoiseStatsChange?: (stats: SelectedNoiseStats) => void;
	onMapReady?: (map: MapLibreMap) => void;
	tripStats?: ModoRow[];
};

type ResolvedTheme = "light" | "dark";

function getResolvedTheme(): ResolvedTheme {
	if (typeof window === "undefined") return "light";
	if (document.documentElement.classList.contains("dark")) return "dark";
	if (document.documentElement.classList.contains("light")) return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function applyMapTheme(map: MapLibreMap, theme: ResolvedTheme) {
	const isDark = theme === "dark";
	const setVisibility = (layerId: string, visible: boolean) => {
		if (map.getLayer(layerId)) {
			map.setLayoutProperty(
				layerId,
				"visibility",
				visible ? "visible" : "none",
			);
		}
	};

	setVisibility("carto-light-tiles", !isDark);
	setVisibility("carto-dark-tiles", isDark);
	setVisibility("carto-dark-labels", isDark);

	if (map.getLayer("map-background")) {
		map.setPaintProperty(
			"map-background",
			"background-color",
			isDark ? "#0b1720" : "#edf4e8",
		);
	}

	if (map.getLayer("terrain-hillshade")) {
		map.setPaintProperty(
			"terrain-hillshade",
			"hillshade-shadow-color",
			isDark ? "rgba(0,0,0,0.34)" : "rgba(0,0,0,0.2)",
		);
		map.setPaintProperty(
			"terrain-hillshade",
			"hillshade-highlight-color",
			isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.25)",
		);
	}
}

interface ModeProfile {
	costing: CostingMode;
	color: string;
	lateralOffset: number;
	/** 0..1 share of trips taken on this mode (EOD 2012 modal split, rounded). */
	routeUsage: number;
	/** 0..1 relative travel speed (1 = fastest urban mode). */
	transportSpeed: number;
	/** `cat_modo` label emitted by /api/comparador/stats. */
	statsKey: string;
}

// Thickness range (display units) at routeUsage 0 -> 1.
const THICKNESS_MIN = 1.0;
const THICKNESS_MAX = 4.4;
// Comet cycle period (seconds) at transportSpeed 1 → 0. Lower cycle = faster sweep.
const CYCLE_FAST = 1.0;
const CYCLE_SLOW = 3.4;

// Fallback ramp for when /api/comparador/stats has no row for the pair —
// preserves the previous visual ordering pedestrian < bicycle < bus < auto.
const MODE_PROFILES: ModeProfile[] = [
	{
		costing: "auto",
		color: "#4f46a5",
		lateralOffset: 0.55,
		routeUsage: 0.85,
		transportSpeed: 1.0,
		statsKey: "Auto",
	},
	{
		costing: "bus",
		color: "#2563eb",
		lateralOffset: -0.35,
		routeUsage: 0.55,
		transportSpeed: 0.45,
		statsKey: "Bus",
	},
	{
		costing: "metro",
		color: "#7c3aed",
		lateralOffset: 0.0,
		routeUsage: 0.65,
		transportSpeed: 0.7,
		statsKey: "Metro/Tren",
	},
	{
		costing: "bicycle",
		color: "#0f766e",
		lateralOffset: 0.15,
		routeUsage: 0.25,
		transportSpeed: 0.35,
		statsKey: "No Motorizado",
	},
];

interface NormalizedStats {
	byMode: Map<CostingMode, { porcentaje: number; velocidad: number }>;
	minPct: number;
	maxPct: number;
	minVel: number;
	maxVel: number;
}

function normalizeStats(stats: ModoRow[] | undefined): NormalizedStats | null {
	if (!stats || stats.length === 0) return null;
	const byMode = new Map<
		CostingMode,
		{ porcentaje: number; velocidad: number }
	>();
	let minPct = Number.POSITIVE_INFINITY;
	let maxPct = Number.NEGATIVE_INFINITY;
	let minVel = Number.POSITIVE_INFINITY;
	let maxVel = Number.NEGATIVE_INFINITY;
	for (const profile of MODE_PROFILES) {
		const row = stats.find((s) => s.modo === profile.statsKey);
		if (!row || row.n_viajes <= 0) continue;
		byMode.set(profile.costing, {
			porcentaje: row.porcentaje,
			velocidad: row.velocidad_promedio,
		});
		if (row.porcentaje < minPct) minPct = row.porcentaje;
		if (row.porcentaje > maxPct) maxPct = row.porcentaje;
		if (row.velocidad_promedio < minVel) minVel = row.velocidad_promedio;
		if (row.velocidad_promedio > maxVel) maxVel = row.velocidad_promedio;
	}
	if (byMode.size === 0) return null;
	return { byMode, minPct, maxPct, minVel, maxVel };
}

function arrowStyleFor(
	profile: ModeProfile,
	normalized: NormalizedStats | null,
): ArrowStyle {
	const stat = normalized?.byMode.get(profile.costing);

	let usage: number;
	if (stat && normalized) {
		// Normalize within the active pair so the thinnest visible mode hits
		// THICKNESS_MIN and the thickest hits THICKNESS_MAX — gives a much more
		// pronounced spread than raw porcentaje/100 (which tops out near 0.35).
		const span = normalized.maxPct - normalized.minPct;
		usage = span > 0 ? (stat.porcentaje - normalized.minPct) / span : 0.5;
	} else {
		usage = Math.min(1, Math.max(0, profile.routeUsage));
	}

	let speedNorm: number;
	if (stat && normalized) {
		const span = normalized.maxVel - normalized.minVel;
		speedNorm = span > 0 ? (stat.velocidad - normalized.minVel) / span : 0.5;
	} else {
		speedNorm = Math.min(1, Math.max(0, profile.transportSpeed));
	}

	return {
		color: profile.color,
		thickness: THICKNESS_MIN + (THICKNESS_MAX - THICKNESS_MIN) * usage,
		highlightSpeed: CYCLE_SLOW - (CYCLE_SLOW - CYCLE_FAST) * speedNorm,
	};
}

/**
 * Inicializa MapLibre, carga el GeoJSON de comunas, monta las
 * capas y conecta los handlers de hover. Devuelve el ref del contenedor y
 * helpers para resetear la vista.
 */
export function useSantiagoMap(
	setHoverInfo: (info: HoverInfo) => void,
	dualSelect?: DualSelect,
) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const pinnedInfoRef = useRef<HoverInfo>(null);
	const clearPinnedEffectsRef = useRef<(() => void) | null>(null);
	const dualSelectRef = useRef(dualSelect);
	const comunasRef = useRef<GeoJSON.FeatureCollection | null>(null);
	const noiseStatsByComunaRef = useRef(new Map<string, NoiseComunaStats>());
	const routeArrowAnimCleanupRef = useRef<(() => void) | null>(null);
	const arrowManagerRef = useRef<ArrowMapLibreManager | null>(null);
	const routeArrowHandlesRef = useRef<Map<CostingMode, ArrowHandle>>(new Map());
	const tripStatsRef = useRef<ModoRow[] | undefined>(dualSelect?.tripStats);
	const mapReadyRef = useRef(false);
	// Ruido: lazy loading — se carga la primera vez que se activa la capa.
	const noiseLoadedRef = useRef(false);
	dualSelectRef.current = dualSelect;
	tripStatsRef.current = dualSelect?.tripStats;

	const clearPinned = useCallback(() => {
		clearPinnedEffectsRef.current?.();
		clearPinnedEffectsRef.current = null;
		pinnedInfoRef.current = null;
		setHoverInfo(null);
	}, [setHoverInfo]);

	/** Carga stats livianos y registra la fuente visual de ruido al activarse. */
	const loadNoiseLayer = useCallback(async () => {
		const map = mapRef.current;
		if (!map || !mapReadyRef.current) return false;
		if (noiseLoadedRef.current) return true;
		const stats = await loadJSON<NoiseComunaStatsRecord[]>(
			"/data/noise-stats.json",
		);
		// Guard: otro call concurrente pudo haber terminado antes.
		if (!stats) return false;
		if (noiseLoadedRef.current) return true;
		noiseLoadedRef.current = true;
		const statsByComuna = buildNoiseComunaStats(stats);
		noiseStatsByComunaRef.current = statsByComuna;
		addNoiseLayers(map, "/data/noise.geojson");
		const noiseComunas = comunasRef.current
			? buildNoiseComunaFeatures(statsByComuna, comunasRef.current)
			: null;
		if (noiseComunas) addNoiseComunaLayers(map, noiseComunas);
		if (map.getLayer("comunas-outline")) map.moveLayer("comunas-outline");
		setLayerGroupVisibility(map, NOISE_ALL_LAYER_IDS, false);
		return true;
	}, []);

	const syncNoiseOverlay = useCallback(
		async (
			selectedOrigen: string | null,
			selectedDestino: string | null,
			showNoiseOverlay: boolean,
		) => {
			const current = dualSelectRef.current;
			const map = mapRef.current;
			const emptyStats: SelectedNoiseStats = { origen: null, destino: null };
			const selected = [selectedOrigen, selectedDestino].filter(
				(name): name is string => Boolean(name),
			);

			if (!showNoiseOverlay || selected.length === 0) {
				if (map?.getSource("noise")) {
					updateNoiseSelectionLayers(map, []);
					setLayerGroupVisibility(map, NOISE_ALL_LAYER_IDS, false);
				}
				current?.onNoiseStatsChange?.(emptyStats);
				return;
			}

			const loaded = await loadNoiseLayer();
			if (!loaded || !mapRef.current) {
				current?.onNoiseStatsChange?.(emptyStats);
				return;
			}

			const nextMap = mapRef.current;
			const statsByComuna = noiseStatsByComunaRef.current;
			const selectedStats: SelectedNoiseStats = {
				origen: getNoiseComunaStats(statsByComuna, selectedOrigen),
				destino: getNoiseComunaStats(statsByComuna, selectedDestino),
			};
			const noiseComunas = [
				selectedStats.origen?.comuna,
				selectedStats.destino?.comuna,
			].filter((comuna): comuna is string => Boolean(comuna));

			updateNoiseSelectionLayers(nextMap, noiseComunas);
			setLayerGroupVisibility(nextMap, NOISE_ALL_LAYER_IDS, false);
			setLayerGroupVisibility(
				nextMap,
				NOISE_OVERLAY_LAYER_IDS,
				noiseComunas.length > 0,
			);
			if (nextMap.getLayer("comunas-outline"))
				nextMap.moveLayer("comunas-outline");
			bringComunaHoverToFront(nextMap);
			bringRouteArrowToFront(nextMap);
			current?.onNoiseStatsChange?.(selectedStats);
		},
		[loadNoiseLayer],
	);

	const origen = dualSelect?.origen ?? null;
	const destino = dualSelect?.destino ?? null;
	const showNoiseOverlay = dualSelect?.showNoiseOverlay ?? false;

	useEffect(() => {
		void syncNoiseOverlay(origen, destino, showNoiseOverlay);
	}, [origen, destino, showNoiseOverlay, syncNoiseOverlay]);

	useEffect(() => {
		let cancelled = false;
		let cleanup: (() => void) | undefined;
		let themeCleanup: (() => void) | undefined;
		const pinController: HoverPinController = {
			isPinned: () => pinnedInfoRef.current !== null,
			pin: (info, clearEffects) => {
				clearPinnedEffectsRef.current?.();
				const pinnedInfo = { ...info, pinned: true };
				pinnedInfoRef.current = pinnedInfo;
				clearPinnedEffectsRef.current = clearEffects ?? null;
				setHoverInfo(pinnedInfo);
			},
		};

		(async () => {
			if (!containerRef.current) return;
			const maplibre = await import("maplibre-gl");
			if (cancelled || !containerRef.current) return;

			const map = new maplibre.Map({
				container: containerRef.current,
				// biome-ignore lint/suspicious/noExplicitAny: MapLibre tiene tipos de style muy estrictos para objetos inline.
				style: structuredClone(BASE_STYLE) as any,
				center: SANTIAGO_CENTER,
				zoom: INITIAL_ZOOM,
				attributionControl: { compact: true },
				dragPan: false,
				scrollZoom: false,
				doubleClickZoom: false,
				touchZoomRotate: false,
				dragRotate: false,
				keyboard: false,
			});
			mapRef.current = map;

			const syncTheme = () => applyMapTheme(map, getResolvedTheme());
			const themeObserver = new MutationObserver(syncTheme);
			themeObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["class"],
			});
			const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
			themeMedia.addEventListener("change", syncTheme);
			themeCleanup = () => {
				themeObserver.disconnect();
				themeMedia.removeEventListener("change", syncTheme);
			};

			map.on("error", (event) => {
				console.error("MapLibre error", event.error ?? event);
			});

			let debugWindow: (typeof window & { __simMap?: MapLibreMap }) | undefined;
			if (import.meta.env.DEV) {
				debugWindow = window as typeof window & { __simMap?: MapLibreMap };
				debugWindow.__simMap = map;
			}

			const resize = () => map.resize();
			const ro = new ResizeObserver(resize);
			if (containerRef.current) ro.observe(containerRef.current);
			requestAnimationFrame(resize);
			setTimeout(resize, 120);

			const hoverCleanup: Array<() => void> = [];

			cleanup = () => {
				themeCleanup?.();
				themeCleanup = undefined;
				pinnedInfoRef.current = null;
				clearPinnedEffectsRef.current = null;
				routeArrowAnimCleanupRef.current?.();
				routeArrowAnimCleanupRef.current = null;
				routeArrowHandlesRef.current.clear();
				arrowManagerRef.current?.dispose();
				arrowManagerRef.current = null;
				for (const fn of hoverCleanup) fn();
				if (debugWindow?.__simMap === map) delete debugWindow.__simMap;
				ro.disconnect();
				map.remove();
			};

			map.on("load", async () => {
				resize();
				syncTheme();

				try {
					map.setLight({
						anchor: "viewport",
						color: "#ffffff",
						intensity: 0.65,
					});
				} catch {}

				const comunas = await getComunasGeoJSON();
				comunasRef.current = comunas;

				if (comunas) addComunaLayers(map, comunas);
				if (comunas) bringComunaHoverToFront(map);
				addODLayers(map);
				addRouteArrowLayers(map);
				bringRouteArrowToFront(map);
				arrowManagerRef.current = createArrowMapLibreManager(map);

				setLayerGroupVisibility(map, COMUNA_ALL_LAYER_IDS, true);
				setLayerGroupVisibility(map, COMUNA_BASE_LAYER_IDS, true);

				map.setCenter(SANTIAGO_CENTER);
				map.setZoom(INITIAL_ZOOM);

				if (comunas) {
					if (dualSelectRef.current) {
						hoverCleanup.push(
							setupComunaDualSelect(map, (name) => {
								dualSelectRef.current?.onSelectComuna(name);
							}),
						);
					} else {
						hoverCleanup.push(
							setupComunaHover(map, pinController, COMUNA_ZOOM),
						);
					}
				}

				mapReadyRef.current = true;
				dualSelectRef.current?.onMapReady?.(map);
				void syncNoiseOverlay(
					dualSelectRef.current?.origen ?? null,
					dualSelectRef.current?.destino ?? null,
					dualSelectRef.current?.showNoiseOverlay ?? false,
				);
			});
		})();

		return () => {
			cancelled = true;
			cleanup?.();
			mapRef.current = null;
		};
	}, [setHoverInfo, syncNoiseOverlay]);

	const resetView = useCallback(() => {
		mapRef.current?.easeTo({
			center: SANTIAGO_CENTER,
			zoom: INITIAL_ZOOM,
			bearing: 0,
			pitch: 0,
			duration: 650,
		});
	}, []);

	const prevOrigenRef = useRef<string | null>(null);
	const prevDestinoRef = useRef<string | null>(null);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		updateComunaSelectionLayers(map, origen, destino);

		const findComunaFeature = (name: string) =>
			comunasRef.current?.features.find(
				(f) =>
					// biome-ignore lint/suspicious/noExplicitAny: GeoJSON property is dynamic
					(f.properties as any)?.Comuna === name,
			);

		const extendBounds = (
			bounds: maplibregl.LngLatBounds,
			feature: GeoJSON.Feature,
		) => {
			if (feature.geometry.type !== "Polygon") return;
			const coords = feature.geometry.coordinates[0] as [number, number][];
			for (const [lng, lat] of coords) bounds.extend([lng, lat]);
		};

		if (
			origen &&
			destino &&
			(origen !== prevOrigenRef.current || destino !== prevDestinoRef.current)
		) {
			const origenFeature = findComunaFeature(origen);
			const destinoFeature = findComunaFeature(destino);
			if (origenFeature && destinoFeature) {
				const bounds = new maplibregl.LngLatBounds();
				extendBounds(bounds, origenFeature);
				extendBounds(bounds, destinoFeature);
				map.fitBounds(bounds, {
					padding: 48,
					maxZoom: COMUNA_ZOOM,
					pitch: MAP_DETAIL_PITCH,
					bearing: MAP_DETAIL_BEARING,
					duration: 650,
				});

				const origenCentroid = getPolygonCentroid(origenFeature);
				const destinoCentroid = getPolygonCentroid(destinoFeature);
				if (origenCentroid && destinoCentroid) {
					for (const handle of routeArrowHandlesRef.current.values())
						handle.remove();
					routeArrowHandlesRef.current.clear();

					precomputePairRoutes(origen, destino);

					for (const profile of MODE_PROFILES) {
						const manager = arrowManagerRef.current;
						if (!manager) return;
						const costing = profile.costing;
						getRoute(origen, destino, costing)
							.then((result) => {
								const mgr = arrowManagerRef.current;
								if (!mgr) return;
								const handle = mgr.add({
									points: result.shape,
									mode: costing,
									style: arrowStyleFor(
										profile,
										normalizeStats(tripStatsRef.current),
									),
								});
								routeArrowHandlesRef.current.set(costing, handle);
							})
							.catch((err) => {
								console.error(`Valhalla route error (${costing}):`, err);
							});
					}
				}
			}
		}

		if (
			!origen &&
			!destino &&
			(prevOrigenRef.current || prevDestinoRef.current)
		) {
			resetView();
			clearRouteArrow(map);
			for (const handle of routeArrowHandlesRef.current.values())
				handle.remove();
			routeArrowHandlesRef.current.clear();
			routeArrowAnimCleanupRef.current?.();
			routeArrowAnimCleanupRef.current = null;
		}

		if (origen && !destino && prevDestinoRef.current) {
			clearRouteArrow(map);
			for (const handle of routeArrowHandlesRef.current.values())
				handle.remove();
			routeArrowHandlesRef.current.clear();
			routeArrowAnimCleanupRef.current?.();
			routeArrowAnimCleanupRef.current = null;
		}

		prevOrigenRef.current = origen;
		prevDestinoRef.current = destino;
	}, [origen, destino, resetView]);

	const tripStats = dualSelect?.tripStats;
	useEffect(() => {
		const handles = routeArrowHandlesRef.current;
		if (handles.size === 0) return;
		const normalized = normalizeStats(tripStats);
		for (const profile of MODE_PROFILES) {
			const handle = handles.get(profile.costing);
			if (!handle) continue;
			handle.update({ style: arrowStyleFor(profile, normalized) });
		}
	}, [tripStats]);

	return {
		containerRef,
		clearPinned,
		resetView,
		mapReadyRef,
	};
}

function setLayerGroupVisibility(
	map: MapLibreMap,
	layerIds: readonly string[],
	visible: boolean,
) {
	for (const layerId of layerIds) {
		if (map.getLayer(layerId)) {
			map.setLayoutProperty(
				layerId,
				"visibility",
				visible ? "visible" : "none",
			);
		}
	}
}
