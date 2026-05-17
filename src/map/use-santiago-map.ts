import type { Map as MapLibreMap } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
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
	METRO_ALL_LAYER_IDS,
	NOISE_ALL_LAYER_IDS,
	SANTIAGO_CENTER,
} from "./config";
import {
	type HoverPinController,
	setupComunaDualSelect,
	setupComunaHover,
	setupMetroStationClick,
	setupNoiseInteraction,
} from "./hover";
import {
	addComunaLayers,
	addMetroLayers,
	addNoiseComunaLayers,
	addNoiseLayers,
	addODLayers,
	addRouteArrowLayers,
	bringComunaHoverToFront,
	bringRouteArrowToFront,
	clearRouteArrow,
	updateComunaSelectionLayers,
} from "./layers";
import { buildNoiseComunaFeatures } from "./noise";
import { getComunasGeoJSON } from "./server-comunas";
import { getMetroGeoJSON } from "./server-metro";
import type { HoverInfo, InteractionMode } from "./types";
import { getPolygonCentroid, loadGeoJSON } from "./utils";

type DualSelect = {
	origen: string | null;
	destino: string | null;
	onSelectComuna: (name: string) => void;
	onMapReady?: (map: MapLibreMap) => void;
};

interface ModeProfile {
	costing: CostingMode;
	color: string;
	lateralOffset: number;
	/** 0..1 share of trips taken on this mode (EOD 2012 modal split, rounded). */
	routeUsage: number;
	/** 0..1 relative travel speed (1 = fastest urban mode). */
	transportSpeed: number;
}

// Thickness range (display units) at routeUsage 0 → 1.
const THICKNESS_MIN = 3.0;
const THICKNESS_MAX = 10.0;
// Comet cycle period (seconds) at transportSpeed 1 → 0. Lower cycle = faster sweep.
const CYCLE_FAST = 1.0;
const CYCLE_SLOW = 3.4;

// TODO: replace these hardcoded `routeUsage` values with real per-pair modal
// share (e.g., from EOD 2012 trips between origen/destino). Until then we use
// a fixed ramp so thickness orders pedestrian < bicycle < bus < auto.
const MODE_PROFILES: ModeProfile[] = [
	{
		costing: "auto",
		color: "#f59e0b",
		lateralOffset: 0.55,
		routeUsage: 0.85,
		transportSpeed: 1.0,
	},
	{
		costing: "bus",
		color: "#3b82f6",
		lateralOffset: -0.35,
		routeUsage: 0.55,
		transportSpeed: 0.45,
	},
	{
		costing: "metro",
		color: "#dc2626",
		lateralOffset: 0.0,
		routeUsage: 0.65,
		transportSpeed: 0.7,
	},
	{
		costing: "bicycle",
		color: "#10b981",
		lateralOffset: 0.15,
		routeUsage: 0.25,
		transportSpeed: 0.35,
	},
	{
		costing: "pedestrian",
		color: "#8b5cf6",
		lateralOffset: -0.55,
		routeUsage: 0.1,
		transportSpeed: 0.12,
	},
];

function arrowStyleFor(profile: ModeProfile): ArrowStyle {
	const usage = Math.min(1, Math.max(0, profile.routeUsage));
	const speed = Math.min(1, Math.max(0, profile.transportSpeed));
	return {
		color: profile.color,
		thickness: THICKNESS_MIN + (THICKNESS_MAX - THICKNESS_MIN) * usage,
		highlightSpeed: CYCLE_SLOW - (CYCLE_SLOW - CYCLE_FAST) * speed,
	};
}

/**
 * Inicializa MapLibre, carga los GeoJSON de Metro/Buses/Ciclovías, monta las
 * capas y conecta los handlers de hover. Devuelve el ref del contenedor y
 * helpers para resetear la vista y alternar modos.
 */
export function useSantiagoMap(
	setHoverInfo: (info: HoverInfo) => void,
	dualSelect?: DualSelect,
	modeRef?: RefObject<InteractionMode>,
) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const pinnedInfoRef = useRef<HoverInfo>(null);
	const clearPinnedEffectsRef = useRef<(() => void) | null>(null);
	const dualSelectRef = useRef(dualSelect);
	const fallbackModeRef = useRef<InteractionMode>("comunas");
	const activeModeRef = modeRef ?? fallbackModeRef;
	const comunasRef = useRef<GeoJSON.FeatureCollection | null>(null);
	const routeArrowAnimCleanupRef = useRef<(() => void) | null>(null);
	const arrowManagerRef = useRef<ArrowMapLibreManager | null>(null);
	const routeArrowHandlesRef = useRef<ArrowHandle[]>([]);
	const mapReadyRef = useRef(false);
	// Ruido: lazy loading — se carga la primera vez que se activa el modo.
	const noiseLoadedRef = useRef(false);
	const pinControllerRef = useRef<HoverPinController | null>(null);
	const hoverCleanupListRef = useRef<Array<() => void>>([]);
	dualSelectRef.current = dualSelect;

	const clearPinned = useCallback(() => {
		clearPinnedEffectsRef.current?.();
		clearPinnedEffectsRef.current = null;
		pinnedInfoRef.current = null;
		setHoverInfo(null);
	}, [setHoverInfo]);

	/** Carga noise.geojson la primera vez que se activa el modo Ruido. */
	const loadNoiseLayer = useCallback(async () => {
		const map = mapRef.current;
		if (!map || noiseLoadedRef.current) return;
		const noise = await loadGeoJSON("/data/noise.geojson");
		// Guard: otro call concurrente pudo haber terminado antes.
		if (!noise || noiseLoadedRef.current) return;
		noiseLoadedRef.current = true;
		addNoiseLayers(map, noise);
		const noiseComunas = comunasRef.current
			? buildNoiseComunaFeatures(noise, comunasRef.current)
			: null;
		if (noiseComunas) addNoiseComunaLayers(map, noiseComunas);
		if (map.getLayer("comunas-outline")) map.moveLayer("comunas-outline");
		const pin = pinControllerRef.current;
		if (pin) {
			hoverCleanupListRef.current.push(
				setupNoiseInteraction(map, setHoverInfo, pin),
			);
		}
		setLayerGroupVisibility(map, NOISE_ALL_LAYER_IDS, true);
	}, [setHoverInfo]);

	const applyModeVisibility = useCallback(
		(mode: InteractionMode) => {
			const map = mapRef.current;
			if (!map) return;

			setLayerGroupVisibility(map, COMUNA_ALL_LAYER_IDS, mode === "comunas");
			if (mode === "noise") {
				setLayerGroupVisibility(map, COMUNA_BASE_LAYER_IDS, true);
			}
			setLayerGroupVisibility(map, METRO_ALL_LAYER_IDS, mode === "metro");
			// Ruido: ocultar/mostrar solo si ya fue cargada; si no, la carga la hace visible.
			if (map.getSource("noise")) {
				setLayerGroupVisibility(map, NOISE_ALL_LAYER_IDS, mode === "noise");
			}
			if (mode === "noise" && !noiseLoadedRef.current) {
				void loadNoiseLayer();
			}
		},
		[loadNoiseLayer],
	);

	useEffect(() => {
		let cancelled = false;
		let cleanup: (() => void) | undefined;
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
				pinnedInfoRef.current = null;
				clearPinnedEffectsRef.current = null;
				routeArrowAnimCleanupRef.current?.();
				routeArrowAnimCleanupRef.current = null;
				routeArrowHandlesRef.current = [];
				arrowManagerRef.current?.dispose();
				arrowManagerRef.current = null;
				for (const fn of hoverCleanup) fn();
				if (debugWindow?.__simMap === map) delete debugWindow.__simMap;
				ro.disconnect();
				map.remove();
			};

			map.on("load", async () => {
				resize();
				// Exponer al hook para que loadNoiseLayer pueda accederlos.
				pinControllerRef.current = pinController;
				hoverCleanupListRef.current = hoverCleanup;

				try {
					map.setLight({
						anchor: "viewport",
						color: "#ffffff",
						intensity: 0.65,
					});
				} catch {}

				const [comunas, metro] = await Promise.all([
					getComunasGeoJSON(),
					getMetroGeoJSON(),
				]);
				comunasRef.current = comunas;

				if (comunas) addComunaLayers(map, comunas);
				if (metro) addMetroLayers(map, metro);
				if (comunas) bringComunaHoverToFront(map);
				addODLayers(map);
				addRouteArrowLayers(map);
				bringRouteArrowToFront(map);
				arrowManagerRef.current = createArrowMapLibreManager(map);

				setLayerGroupVisibility(
					map,
					COMUNA_ALL_LAYER_IDS,
					activeModeRef.current === "comunas",
				);
				if (activeModeRef.current === "noise") {
					setLayerGroupVisibility(map, COMUNA_BASE_LAYER_IDS, true);
				}
				setLayerGroupVisibility(
					map,
					METRO_ALL_LAYER_IDS,
					activeModeRef.current === "metro",
				);

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
							setupComunaHover(map, pinController, COMUNA_ZOOM, activeModeRef),
						);
					}
				}
				if (metro) {
					hoverCleanup.push(
						setupMetroStationClick(map, pinController, activeModeRef),
					);
				}

				mapReadyRef.current = true;
				dualSelectRef.current?.onMapReady?.(map);
			});
		})();

		return () => {
			cancelled = true;
			cleanup?.();
			mapRef.current = null;
		};
	}, [setHoverInfo, activeModeRef]);

	const resetView = useCallback(() => {
		mapRef.current?.easeTo({
			center: SANTIAGO_CENTER,
			zoom: INITIAL_ZOOM,
			bearing: 0,
			pitch: 0,
			duration: 650,
		});
	}, []);

	const origen = dualSelect?.origen ?? null;
	const destino = dualSelect?.destino ?? null;
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
					for (const handle of routeArrowHandlesRef.current) handle.remove();
					routeArrowHandlesRef.current = [];

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
									style: arrowStyleFor(profile),
								});
								routeArrowHandlesRef.current.push(handle);
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
			for (const handle of routeArrowHandlesRef.current) handle.remove();
			routeArrowHandlesRef.current = [];
			routeArrowAnimCleanupRef.current?.();
			routeArrowAnimCleanupRef.current = null;
		}

		if (origen && !destino && prevDestinoRef.current) {
			clearRouteArrow(map);
			for (const handle of routeArrowHandlesRef.current) handle.remove();
			routeArrowHandlesRef.current = [];
			routeArrowAnimCleanupRef.current?.();
			routeArrowAnimCleanupRef.current = null;
		}

		prevOrigenRef.current = origen;
		prevDestinoRef.current = destino;
	}, [origen, destino, resetView]);

	return {
		containerRef,
		clearPinned,
		resetView,
		mapReadyRef,
		applyModeVisibility,
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
