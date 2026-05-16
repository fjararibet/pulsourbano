import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import {
	BASE_STYLE,
	INITIAL_ZOOM,
	SANTIAGO_CENTER,
} from "./config";
import { setupBusRouteHover, setupHoverLayer } from "./hover";
import {
	addBusLayers,
	addCyclewayLayers,
	addMetroLayers,
	applyLayerVisibility,
} from "./layers";
import type {
	FrequencyMap,
	HoverInfo,
	LayerVisibility,
} from "./types";
import {
	formatStationName,
	getFeatureString,
	getFeatureNumber,
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

	// Mantener un ref con la última visibilidad para usarla dentro del effect
	// de montaje sin reinicializar el mapa cada vez que cambian las capas.
	useEffect(() => {
		visibleLayersRef.current = visibleLayers;
		applyLayerVisibility(mapRef.current, visibleLayers);
	}, [visibleLayers]);

	useEffect(() => {
		let cancelled = false;
		let cleanup: (() => void) | undefined;

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
			let debugWindow:
				| (typeof window & { __simMap?: MapLibreMap })
				| undefined;
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
				for (const fn of hoverCleanup) fn();
				popup.remove();
				if (debugWindow?.__simMap === map) delete debugWindow.__simMap;
				ro.disconnect();
				map.remove();
			};

			map.on("load", async () => {
				resize();
				const [metro, buses, cycleways, frequencies] = await Promise.all([
					loadGeoJSON("/data/metro.geojson"),
					loadGeoJSON("/data/buses.geojson"),
					loadGeoJSON("/data/ciclovias.geojson"),
					loadJSON<FrequencyMap>("/data/frequencies.json"),
				]);

				if (buses) addBusLayers(map, buses);
				if (cycleways) addCyclewayLayers(map, cycleways);
				if (metro) addMetroLayers(map, metro);

				applyLayerVisibility(map, visibleLayersRef.current);

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
					),
					setupHoverLayer(
						map,
						popup,
						"metro-stations",
						setHoverInfo,
						(feature) => {
							const name = formatStationName(
								getFeatureString(feature, "name"),
							);
							return {
								kind: "Estación",
								title: name || "Estación de Metro",
								description:
									getFeatureString(feature, "stop_id") || "Punto de acceso",
								accent: "#102f37",
							};
						},
					),
					setupBusRouteHover(map, popup, setHoverInfo, frequencies),
					setupHoverLayer(map, popup, "bus-stops", setHoverInfo, (feature) => {
						const name = formatStationName(getFeatureString(feature, "name"));
						return {
							kind: "Paradero RED",
							title: name || "Paradero",
							description:
								getFeatureString(feature, "stop_id") || "Punto de parada",
							accent: "#f2a900",
						};
					}),
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

	return { containerRef, resetView };
}
