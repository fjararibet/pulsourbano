import type { Map as MapLibreMap } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import {
	type ArrowHandle,
	type ArrowScene,
	type ArrowStyle,
	arcLineString,
	createArrowScene,
} from "./ArrowScene";
import {
	BASE_STYLE,
	COMUNA_ALL_LAYER_IDS,
	COMUNA_ZOOM,
	INITIAL_ZOOM,
	MAP_DETAIL_BEARING,
	MAP_DETAIL_PITCH,
	METRO_ALL_LAYER_IDS,
	SANTIAGO_CENTER,
} from "./config";
import {
	type HoverPinController,
	setupComunaDualSelect,
	setupComunaHover,
	setupMetroStationClick,
} from "./hover";
import {
	addComunaLayers,
	addMetroLayers,
	addODLayers,
	addRouteArrowLayers,
	bringComunaHoverToFront,
	bringRouteArrowToFront,
	clearRouteArrow,
	updateComunaSelectionLayers,
} from "./layers";
import { getComunasGeoJSON } from "./server-comunas";
import { getMetroGeoJSON } from "./server-metro";
import type { HoverInfo, InteractionMode } from "./types";
import { getPolygonCentroid } from "./utils";

type DualSelect = {
	origen: string | null;
	destino: string | null;
	onSelectComuna: (name: string) => void;
	onMapReady?: (map: MapLibreMap) => void;
};

interface RouteVariant {
	lateralOffset: number;
	style: ArrowStyle;
}

const ROUTE_VARIANTS: RouteVariant[] = [
	{
		lateralOffset: 0.55,
		style: { color: "#f59e0b", thickness: 4.5, highlightSpeed: 1.8 },
	},
	{
		lateralOffset: -0.35,
		style: {
			color: "#3b82f6",
			thickness: 3.2,
			archHeight: 0.12,
			highlightSpeed: 1.2,
		},
	},
	{
		lateralOffset: 0.15,
		style: {
			color: "#10b981",
			thickness: 2.6,
			archHeight: 0.08,
			highlightSpeed: 2.6,
		},
	},
];

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
	const arrowSceneRef = useRef<ArrowScene | null>(null);
	const routeArrowHandlesRef = useRef<ArrowHandle[]>([]);
	const mapReadyRef = useRef(false);
	dualSelectRef.current = dualSelect;

	const clearPinned = useCallback(() => {
		clearPinnedEffectsRef.current?.();
		clearPinnedEffectsRef.current = null;
		pinnedInfoRef.current = null;
		setHoverInfo(null);
	}, [setHoverInfo]);

	const applyModeVisibility = useCallback((mode: InteractionMode) => {
		const map = mapRef.current;
		if (!map) return;

		setLayerGroupVisibility(map, COMUNA_ALL_LAYER_IDS, mode === "comunas");
		setLayerGroupVisibility(map, METRO_ALL_LAYER_IDS, mode === "metro");
	}, []);

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
				arrowSceneRef.current?.dispose();
				arrowSceneRef.current = null;
				for (const fn of hoverCleanup) fn();
				if (debugWindow?.__simMap === map) delete debugWindow.__simMap;
				ro.disconnect();
				map.remove();
			};

			map.on("load", async () => {
				resize();

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
				if (containerRef.current) {
					arrowSceneRef.current = createArrowScene(map, containerRef.current);
				}

				setLayerGroupVisibility(
					map,
					COMUNA_ALL_LAYER_IDS,
					activeModeRef.current === "comunas",
				);
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
				dualSelect?.onMapReady?.(map);
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
				const scene = arrowSceneRef.current;
				if (origenCentroid && destinoCentroid && scene) {
					for (const handle of routeArrowHandlesRef.current) handle.remove();
					routeArrowHandlesRef.current = ROUTE_VARIANTS.map((variant) =>
						scene.add({
							points: arcLineString(origenCentroid, destinoCentroid, {
								lateralOffset: variant.lateralOffset,
							}),
							style: variant.style,
						}),
					);
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
