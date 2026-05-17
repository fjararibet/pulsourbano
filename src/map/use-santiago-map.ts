import type { Map as MapLibreMap } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef } from "react";
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
import {
	hideRouteArrowOverlay,
	initRouteArrowOverlay,
	showRouteArrowOverlay,
} from "./RouteArrowOverlay";
import type { HoverInfo } from "./types";
import { createArcLineString, getPolygonCentroid, loadGeoJSON } from "./utils";

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
	const arrowOverlayCleanupRef = useRef<(() => void) | null | undefined>(null);
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
				arrowOverlayCleanupRef.current?.();
				arrowOverlayCleanupRef.current = null;
				for (const fn of hoverCleanup) fn();
				if (debugWindow?.__simMap === map) delete debugWindow.__simMap;
				ro.disconnect();
				map.remove();
			};

			map.on("load", async () => {
				resize();

				// Luz direccional para que el relieve del terreno proyecte sombras
				try {
					map.setLight({
						anchor: "viewport",
						color: "#ffffff",
						intensity: 0.65,
					});
				} catch {
					// Si el navegador no soporta WebGL para terreno, continuar sin
				}

				const comunas = await loadGeoJSON("/data/comunas_rm.geojson");
				comunasRef.current = comunas;

				if (comunas) addComunaLayers(map, comunas);
				if (comunas) bringComunaHoverToFront(map);
				addRouteArrowLayers(map);
				bringRouteArrowToFront(map);
				if (containerRef.current) {
					arrowOverlayCleanupRef.current = initRouteArrowOverlay(
						map,
						containerRef.current,
					);
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

				// Generar flecha de ruta origen-destino (canvas overlay 3D)
				const origenCentroid = getPolygonCentroid(origenFeature);
				const destinoCentroid = getPolygonCentroid(destinoFeature);
				if (origenCentroid && destinoCentroid) {
					const arc = createArcLineString(origenCentroid, destinoCentroid);
					const coords = arc.geometry.coordinates;
					const secondToLast = coords[coords.length - 2] as
						| [number, number]
						| undefined;
					const last = coords[coords.length - 1] as
						| [number, number]
						| undefined;
					if (last && secondToLast) {
						const dx = last[0] - secondToLast[0];
						const dy = last[1] - secondToLast[1];
						const bearing = ((-Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;

						showRouteArrowOverlay(
							map,
							coords as [number, number][],
							bearing,
							last,
						);
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
			hideRouteArrowOverlay();
			routeArrowAnimCleanupRef.current?.();
			routeArrowAnimCleanupRef.current = null;
		}

		if (origen && !destino && prevDestinoRef.current) {
			// Se quitó el destino: limpiar flecha
			clearRouteArrow(map);
			hideRouteArrowOverlay();
			routeArrowAnimCleanupRef.current?.();
			routeArrowAnimCleanupRef.current = null;
		}

		prevOrigenRef.current = origen;
		prevDestinoRef.current = destino;
	}, [origen, destino, resetView]);

	return { containerRef, clearPinned, resetView };
}
