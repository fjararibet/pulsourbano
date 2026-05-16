import type { MapGeoJSONFeature, Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef } from "react";
import {
	calculateQuickSimulation,
	type QuickSimulationInput,
	type QuickSimulationResult,
} from "#/simulation/quick-simulation";
import {
	createStationImpact,
	createStationImpactFeatureCollection,
	DEFAULT_STATION_IMPACT_RADIUS_METERS,
	type LonLat,
	type StationImpact,
} from "#/simulation/station-impact";
import { BASE_STYLE, INITIAL_ZOOM, SANTIAGO_CENTER } from "./config";
import {
	createPopupHtml,
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
	addSimulationImpactLayers,
	applyLayerVisibility,
	bringComunaHoverToFront,
	clearSimulationImpact,
	setSimulationImpactData,
	startSimulationImpactAnimation,
} from "./layers";
import { getBusesGeoJSON } from "./server-buses";
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
	simulationInput: QuickSimulationInput,
) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const visibleLayersRef = useRef(visibleLayers);
	const simulationInputRef = useRef(simulationInput);
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
		simulationInputRef.current = simulationInput;
	}, [simulationInput]);

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
						getBusesGeoJSON().catch(() => null),
						loadGeoJSON("/data/ciclovias.geojson"),
						loadJSON<FrequencyMap>("/data/frequencies.geojson"),
						loadJSON<TravelTimeMap>("/data/travel-times.geojson"),
					]);

				if (comunas) addComunaLayers(map, comunas);
				if (buses) addBusLayers(map, buses);
				if (cycleways) addCyclewayLayers(map, cycleways);
				if (metro) addMetroLayers(map, metro);
				addSimulationImpactLayers(map);
				if (comunas) bringComunaHoverToFront(map);

				map.setCenter(SANTIAGO_CENTER);
				map.setZoom(INITIAL_ZOOM);

				applyLayerVisibility(map, visibleLayersRef.current);
				let stopStationImpactAnimation: (() => void) | null = null;
				const clearStationImpactEffects = () => {
					stopStationImpactAnimation?.();
					stopStationImpactAnimation = null;
					clearSimulationImpact(map);
					map.getCanvas().style.cursor = "";
					popup.remove();
				};

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
						{
							onClick: ({ feature, info }) => {
								const center = getPointCoordinates(feature);
								if (!center || !metro) return;

								const currentInput = simulationInputRef.current;
								const result = calculateQuickSimulation(currentInput);
								const accent = getSimulationAccent(currentInput);
								const stationId =
									getFeatureString(feature, "stop_id") || info.title;
								const impact = createStationImpact({
									stationId,
									stationName: info.title,
									center,
									radiusMeters: DEFAULT_STATION_IMPACT_RADIUS_METERS,
									metroData: metro,
									busesData: buses,
								});
								const impactInfo = formatStationImpactInfo(
									impact,
									result,
									currentInput,
									accent,
								);

								pinController.pin(impactInfo, clearStationImpactEffects);
								setSimulationImpactData(
									map,
									createStationImpactFeatureCollection(impact, accent),
								);
								stopStationImpactAnimation = startSimulationImpactAnimation(
									map,
									accent,
								);
								map.getCanvas().style.cursor = "pointer";
								popup
									.setLngLat(center)
									.setHTML(createPopupHtml(impactInfo))
									.addTo(map);
								map.easeTo({
									center,
									zoom: Math.max(map.getZoom(), 14.2),
									duration: 700,
								});
							},
						},
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

	return { containerRef, clearPinned };
}

const integerFormatter = new Intl.NumberFormat("es-CL", {
	maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("es-CL", {
	maximumFractionDigits: 1,
});

function formatStationImpactInfo(
	impact: StationImpact,
	result: QuickSimulationResult,
	input: QuickSimulationInput,
	accent: string,
): Exclude<HoverInfo, null> {
	const isOpening = input.direction === "opening";
	const impactWord = isOpening ? "evitados" : "extra";
	const kind = isOpening ? "Apertura estación" : "Cierre estación";
	const description = `${formatMeters(
		impact.radiusMeters,
	)} de influencia · ${impact.nearbyStations.length} estaciones alternativas · ${
		impact.nearbyBusStops.length
	} paraderos RED`;

	return {
		kind,
		title: impact.stationName,
		description,
		popupTitle: `${kind}: ${impact.stationName}`,
		popupDescription: `${formatSigned(
			result.kgCo2PerDay,
			"integer",
		)} kg CO2/día ${impactWord}`,
		details: [
			`Radio de influencia: ${formatMeters(impact.radiusMeters)}`,
			`Estaciones Metro cercanas: ${integerFormatter.format(
				impact.nearbyStations.length,
			)}`,
			`Paraderos RED cercanos: ${integerFormatter.format(
				impact.nearbyBusStops.length,
			)}`,
			`${formatSigned(result.carTrips, "integer")} viajes-auto/día`,
			`${formatSigned(result.vehicleKmPerDay, "integer")} veh-km/día`,
			`${formatSigned(result.kgCo2PerDay, "integer")} kg CO2/día`,
			`${formatSigned(result.tonCo2PerYear, "decimal")} ton CO2/año`,
		],
		note: "Impacto exploratorio sin EOD: área y alternativas reales; demanda por supuestos.",
		pinned: true,
		accent,
	};
}

function getPointCoordinates(feature: MapGeoJSONFeature): LonLat | null {
	if (feature.geometry.type !== "Point") return null;
	const [longitude, latitude] = feature.geometry.coordinates;
	if (typeof longitude !== "number" || typeof latitude !== "number")
		return null;
	return [longitude, latitude];
}

function getSimulationAccent(input: QuickSimulationInput) {
	return input.direction === "opening" ? "#168a76" : "#d75235";
}

function formatMeters(value: number) {
	return `${integerFormatter.format(value)} m`;
}

function formatSigned(value: number, precision: "integer" | "decimal") {
	const formatter =
		precision === "integer" ? integerFormatter : decimalFormatter;
	const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
	return `${prefix}${formatter.format(Math.abs(value))}`;
}
