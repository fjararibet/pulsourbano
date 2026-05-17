import type { Map as MapLibreMap } from "maplibre-gl";
import maplibregl from "maplibre-gl";
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
	COMUNA_ZOOM,
	INITIAL_ZOOM,
	MAP_DETAIL_BEARING,
	MAP_DETAIL_PITCH,
	SANTIAGO_CENTER,
} from "./config";
import {
	type HoverPinController,
	setupComunaDualSelect,
	setupComunaHover,
} from "./hover";
import {
	addComunaLayers,
	addRouteArrowLayers,
	bringComunaHoverToFront,
	bringRouteArrowToFront,
	clearRouteArrow,
	updateComunaSelectionLayers,
} from "./layers";
import type { HoverInfo } from "./types";
import { getPolygonCentroid, loadGeoJSON } from "./utils";

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
 * un helper para resetear la vista.
 */
export function useSantiagoMap(
	setHoverInfo: (info: HoverInfo) => void,
	dualSelect?: {
		origen: string | null;
		destino: string | null;
		onSelectComuna: (name: string) => void;
	},
) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const pinnedInfoRef = useRef<HoverInfo>(null);
	const clearPinnedEffectsRef = useRef<(() => void) | null>(null);
	const dualSelectRef = useRef(dualSelect);
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
			const maplibregl = await import("maplibre-gl");
			if (cancelled || !containerRef.current) return;

			const map = new maplibregl.Map({
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

			// Exponer el mapa al window en dev para debug desde la consola.
			let debugWindow: (typeof window & { __simMap?: MapLibreMap }) | undefined;
			if (import.meta.env.DEV) {
				debugWindow = window as typeof window & { __simMap?: MapLibreMap };
				debugWindow.__simMap = map;
			}

			// Resize defensivo: en algunos layouts (mobile, tabs) el contenedor
			// arranca con tamaño 0 y MapLibre lo deja en blanco si no le decimos.
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

				const comunas = await loadGeoJSON("/data/comunas_rm.geojson");
				comunasRef.current = comunas;

				if (comunas) addComunaLayers(map, comunas);
				if (comunas) bringComunaHoverToFront(map);
				addRouteArrowLayers(map);
				bringRouteArrowToFront(map);
				if (containerRef.current) {
					arrowSceneRef.current = createArrowScene(map, containerRef.current);
				}

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
			});
		})();

		return () => {
			cancelled = true;
			cleanup?.();
			mapRef.current = null;
		};
	}, [setHoverInfo]);

	const resetView = useCallback(() => {
		mapRef.current?.easeTo({
			center: SANTIAGO_CENTER,
			zoom: INITIAL_ZOOM,
			bearing: 0,
			pitch: 0,
			duration: 200,
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

				// Generar flechas de ruta origen-destino (3 rutas distintas)
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
			// Se quitó el destino: limpiar flecha
			clearRouteArrow(map);
			for (const handle of routeArrowHandlesRef.current) handle.remove();
			routeArrowHandlesRef.current = [];
			routeArrowAnimCleanupRef.current?.();
			routeArrowAnimCleanupRef.current = null;
		}

		prevOrigenRef.current = origen;
		prevDestinoRef.current = destino;
	}, [origen, destino, resetView]);

	return { containerRef, clearPinned, resetView, mapReadyRef };
}
