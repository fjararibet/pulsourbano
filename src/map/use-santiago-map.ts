import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef } from "react";
import { BASE_STYLE, INITIAL_ZOOM, SANTIAGO_CENTER } from "./config";
import {
	type HoverPinController,
	setupBusRouteHover,
	setupComunaHover,
	setupHoverLayer,
} from "./hover";
import {
	addBusLayers,
	addComunaLayers,
	addCyclewayLayers,
	addMetroLayers,
	applyLayerVisibility,
} from "./layers";
import type {
	FrequencyMap,
	HoverInfo,
	LayerVisibility,
	TravelTimeMap,
} from "./types";
import {
	formatStationName,
	getFeatureNumber,
	getFeatureString,
	loadGeoJSON,
	loadJSON,
} from "./utils";

/**
 * Inicializa MapLibre, carga los GeoJSON de Metro/Buses/Ciclovías, monta las
 * capas y conecta los handlers de hover. Devuelve el ref del contenedor y
 * un helper para resetear la vista.
 */
export function useSantiagoMap(
	visibleLayers: LayerVisibility,
	setHoverInfo: (info: HoverInfo) => void,
) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const visibleLayersRef = useRef(visibleLayers);
	const pinnedInfoRef = useRef<HoverInfo>(null);
	const clearPinnedEffectsRef = useRef<(() => void) | null>(null);

	const clearPinned = useCallback(() => {
		clearPinnedEffectsRef.current?.();
		clearPinnedEffectsRef.current = null;
		pinnedInfoRef.current = null;
		setHoverInfo(null);
	}, [setHoverInfo]);

	// Mantener un ref con la última visibilidad para usarla dentro del effect
	// de montaje sin reinicializar el mapa cada vez que cambian las capas.
	useEffect(() => {
		visibleLayersRef.current = visibleLayers;
		applyLayerVisibility(mapRef.current, visibleLayers);
	}, [visibleLayers]);

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
			});

			map.on("error", (event) => {
				console.error("MapLibre error", event.error ?? event);
			});

			map.addControl(new maplibregl.NavigationControl(), "top-right");
			mapRef.current = map;

			// Exponer el mapa al window en dev para debug desde la consola.
			let debugWindow: (typeof window & { __simMap?: MapLibreMap }) | undefined;
			if (import.meta.env.DEV) {
				debugWindow = window as typeof window & { __simMap?: MapLibreMap };
				debugWindow.__simMap = map;
			}

			const popup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				offset: 14,
				className: "santiago-map-popup",
			});

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
				for (const fn of hoverCleanup) fn();
				popup.remove();
				if (debugWindow?.__simMap === map) delete debugWindow.__simMap;
				ro.disconnect();
				map.remove();
			};

			map.on("load", async () => {
				resize();
				const [comunas, metro, buses, cycleways, frequencies, travelTimes] =
					await Promise.all([
						loadGeoJSON("/data/comunas_rm.geojson"),
						loadGeoJSON("/data/metro.geojson"),
						loadGeoJSON("/data/buses.geojson"),
						loadGeoJSON("/data/ciclovias.geojson"),
						loadJSON<FrequencyMap>("/data/frequencies.geojson"),
						loadJSON<TravelTimeMap>("/data/travel-times.geojson"),
					]);

				if (comunas) addComunaLayers(map, comunas);
				if (buses) addBusLayers(map, buses);
				if (cycleways) addCyclewayLayers(map, cycleways);
				if (metro) addMetroLayers(map, metro);

				applyLayerVisibility(map, visibleLayersRef.current);

				if (comunas) {
					hoverCleanup.push(
						setupComunaHover(map, popup, setHoverInfo, pinController),
					);
				}

				hoverCleanup.push(
					setupHoverLayer(
						map,
						popup,
						"metro-lines",
						setHoverInfo,
						(feature) => {
							const shortName =
								getFeatureString(feature, "short_name") || "Metro";
							return {
								kind: "Metro",
								title: shortName,
								description:
									getFeatureString(feature, "long_name") || "Línea de Metro",
								accent: getFeatureString(feature, "color") || "#0f8f98",
							};
						},
						pinController,
					),
					setupHoverLayer(
						map,
						popup,
						"metro-stations",
						setHoverInfo,
						(feature) => {
							const name = formatStationName(getFeatureString(feature, "name"));
							return {
								kind: "Estación",
								title: name || "Estación de Metro",
								description:
									getFeatureString(feature, "stop_id") || "Punto de acceso",
								accent: "#102f37",
							};
						},
						pinController,
					),
					setupBusRouteHover(
						map,
						popup,
						setHoverInfo,
						pinController,
						frequencies,
						travelTimes,
					),
					setupHoverLayer(
						map,
						popup,
						"bus-stops",
						setHoverInfo,
						(feature) => {
							const name = formatStationName(getFeatureString(feature, "name"));
							return {
								kind: "Paradero RED",
								title: name || "Paradero",
								description:
									getFeatureString(feature, "stop_id") || "Punto de parada",
								accent: "#f2a900",
							};
						},
						pinController,
					),
					setupHoverLayer(
						map,
						popup,
						"cycleway-lines",
						setHoverInfo,
						(feature) => {
							const name = getFeatureString(feature, "name").replace(
								/^\*\s*/,
								"",
							);
							return {
								kind: "Ciclovía",
								title: name || "Segmento ciclista",
								description:
									getFeatureString(feature, "popupinfo") ||
									`${getFeatureNumber(feature, "longitud") || ""} km`.trim(),
								accent: "#10a56f",
							};
						},
						pinController,
					),
				);
			});
		})();

		return () => {
			cancelled = true;
			cleanup?.();
			mapRef.current = null;
		};
	}, [setHoverInfo]);

	const resetView = () => {
		mapRef.current?.easeTo({
			center: SANTIAGO_CENTER,
			zoom: INITIAL_ZOOM,
			bearing: 0,
			pitch: 0,
			duration: 700,
		});
	};

	return { containerRef, resetView, clearPinned };
}
