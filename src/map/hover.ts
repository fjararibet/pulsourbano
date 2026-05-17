import type {
	FilterSpecification,
	MapGeoJSONFeature,
	MapLayerMouseEvent,
	Map as MapLibreMap,
	Popup,
} from "maplibre-gl";
import maplibregl from "maplibre-gl";
import {
	BUS_COLOR,
	COMUNA_COLOR,
	COMUNA_INTERACTION_LAYER_ID,
	COMUNA_SELECTED_LAYER_IDS,
	EMPTY_BUS_HOVER_FILTER,
	EMPTY_COMUNA_HOVER_FILTER,
	EMPTY_NOISE_COMUNA_FILTER,
	MAP_DETAIL_BEARING,
	MAP_DETAIL_PITCH,
	NOISE_COMUNA_HOVER_LAYER_IDS,
	NOISE_COMUNA_INTERACTION_LAYER_ID,
	NOISE_COMUNA_SELECTED_LAYER_IDS,
	NOISE_SELECTED_ZONE_LAYER_IDS,
} from "./config";
import { noiseDbColor } from "./noise";
import type {
	FrequencyInfo,
	FrequencyMap,
	HoverInfo,
	InteractionMode,
	TravelTimeInfo,
	TravelTimeMap,
} from "./types";
import {
	escapeHtml,
	formatHeadway,
	formatHeadwayShort,
	formatTravelTime,
	formatTravelTimeShort,
	getFeatureNumber,
	getFeatureString,
} from "./utils";

export type HoverPinController = {
	isPinned: () => boolean;
	pin: (
		info: Exclude<HoverInfo, null>,
		clearEffects?: (() => void) | null,
	) => void;
};

type HoverLayerClickPayload = {
	event: MapLayerMouseEvent;
	feature: MapGeoJSONFeature;
	info: Exclude<HoverInfo, null>;
};

type HoverLayerOptions = {
	onClick?: (payload: HoverLayerClickPayload) => void;
};

/**
 * Wire básico: mientras el cursor esté sobre `layerId`, mostrar popup +
 * panel lateral con el feature bajo el cursor. Devuelve una función de
 * cleanup que desconecta los listeners.
 */
export function setupHoverLayer(
	map: MapLibreMap,
	popup: Popup,
	layerId: string,
	setHoverInfo: (info: HoverInfo) => void,
	formatFeature: (feature: MapGeoJSONFeature) => Exclude<HoverInfo, null>,
	pinController: HoverPinController,
	options?: HoverLayerOptions,
) {
	const onMove = (event: MapLayerMouseEvent) => {
		if (pinController.isPinned()) return;
		const feature = event.features?.[0];
		if (!feature) return;
		const info = formatFeature(feature);
		popup.setLngLat(event.lngLat).setHTML(createPopupHtml(info)).addTo(map);
		setHoverInfo(info);
	};

	const onLeave = () => {
		if (pinController.isPinned()) return;
		popup.remove();
		setHoverInfo(null);
	};

	const onClick = (event: MapLayerMouseEvent) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const info = formatFeature(feature);
		if (options?.onClick) {
			options.onClick({ event, feature, info });
			return;
		}

		const pinnedInfo = { ...info, pinned: true };
		pinController.pin(pinnedInfo, () => {
			popup.remove();
		});
		popup
			.setLngLat(event.lngLat)
			.setHTML(createPopupHtml(pinnedInfo))
			.addTo(map);
	};

	map.on("mousemove", layerId, onMove);
	map.on("mouseleave", layerId, onLeave);
	map.on("click", layerId, onClick);

	return () => {
		map.off("mousemove", layerId, onMove);
		map.off("mouseleave", layerId, onLeave);
		map.off("click", layerId, onClick);
	};
}

/**
 * Click de comunas: tap selecciona, zoom in, y resalta la comuna.
 * Sin estado de hover — mobile first.
 */
export function setupComunaHover(
	map: MapLibreMap,
	pinController: HoverPinController,
	comunaZoom: number,
	modeRef: { current: InteractionMode },
) {
	const setSelectedFilter = (feature: MapGeoJSONFeature | null) => {
		const code = feature ? getFeatureNumber(feature, "cod_comuna") : null;
		const filter: FilterSpecification = code
			? ["==", ["get", "cod_comuna"], code]
			: EMPTY_COMUNA_HOVER_FILTER;
		for (const layerId of COMUNA_SELECTED_LAYER_IDS) {
			if (map.getLayer(layerId)) map.setFilter(layerId, filter);
		}
	};

	const onClick = (event: MapLayerMouseEvent) => {
		if (modeRef.current !== "comunas") return;
		const feature = event.features?.[0];
		if (!feature) return;
		const coords = (feature.geometry as GeoJSON.Polygon).coordinates[0] as [
			number,
			number,
		][];
		const bounds = coords.reduce(
			(b, [lng, lat]) => b.extend([lng, lat]),
			new maplibregl.LngLatBounds(coords[0], coords[0]),
		);
		map.fitBounds(bounds, {
			padding: 48,
			maxZoom: comunaZoom,
			pitch: MAP_DETAIL_PITCH,
			bearing: MAP_DETAIL_BEARING,
			duration: 650,
		});

		const info = formatComunaHover(feature, true);
		pinController.pin(info, () => {
			setSelectedFilter(null);
		});

		setSelectedFilter(feature);
	};

	map.on("click", COMUNA_INTERACTION_LAYER_ID, onClick);

	return () => {
		map.off("click", COMUNA_INTERACTION_LAYER_ID, onClick);
		setSelectedFilter(null);
	};
}

/**
 * Selección dual de comunas: click en una comuna la marca como origen o destino.
 * También fija hoverInfo para mostrar el panel de la comuna.
 */
export function setupComunaDualSelect(
	map: MapLibreMap,
	onSelectComuna: (name: string) => void,
) {
	const onClick = (event: MapLayerMouseEvent) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const name = getFeatureString(feature, "Comuna");
		if (name) {
			onSelectComuna(name);
		}
	};

	map.on("click", COMUNA_INTERACTION_LAYER_ID, onClick);

	return () => {
		map.off("click", COMUNA_INTERACTION_LAYER_ID, onClick);
	};
}

/**
 * Hover especializado para `bus-routes`: muestrea con un cuadradito alrededor
 * del cursor para capturar varios recorridos superpuestos y resalta todos
 * los que pasan por ese tramo.
 */
export function setupBusRouteHover(
	map: MapLibreMap,
	popup: Popup,
	setHoverInfo: (info: HoverInfo) => void,
	pinController: HoverPinController,
	frequencies: FrequencyMap | null,
	travelTimes: TravelTimeMap | null,
) {
	const clearHover = () => {
		map.setFilter("bus-hover-lines", EMPTY_BUS_HOVER_FILTER);
		map.setFilter("bus-hover-arrows", EMPTY_BUS_HOVER_FILTER);
		popup.remove();
		if (!pinController.isPinned()) setHoverInfo(null);
	};
	const shouldYieldToMetroStation = (point: MapLayerMouseEvent["point"]) => {
		if (!map.getLayer("metro-stations")) return false;
		const padding = 8;
		return (
			map.queryRenderedFeatures(
				[
					[point.x - padding, point.y - padding],
					[point.x + padding, point.y + padding],
				],
				{ layers: ["metro-stations"] },
			).length > 0
		);
	};

	const setHoveredRoutes = (busRoutes: MapGeoJSONFeature[]) => {
		const routeKeys = busRoutes
			.map((feature) => getFeatureString(feature, "route_key"))
			.filter(Boolean)
			.slice(0, 12);
		const hoverFilter: FilterSpecification = [
			"in",
			["get", "route_key"],
			["literal", routeKeys],
		];

		map.setFilter("bus-hover-lines", hoverFilter);
		map.setFilter("bus-hover-arrows", hoverFilter);
	};

	const onMove = (event: MapLayerMouseEvent) => {
		if (pinController.isPinned()) return;
		if (shouldYieldToMetroStation(event.point)) {
			clearHover();
			return;
		}

		const padding = 6;
		const features = map.queryRenderedFeatures(
			[
				[event.point.x - padding, event.point.y - padding],
				[event.point.x + padding, event.point.y + padding],
			],
			{ layers: ["bus-routes"] },
		);
		const busRoutes = uniqueRouteFeatures(features);

		if (busRoutes.length === 0) {
			clearHover();
			return;
		}

		setHoveredRoutes(busRoutes);

		const info = formatBusRouteHover(
			busRoutes,
			frequencies,
			travelTimes,
			false,
		);
		popup.setLngLat(event.lngLat).setHTML(createPopupHtml(info)).addTo(map);
		setHoverInfo(info);
	};

	const onClick = (event: MapLayerMouseEvent) => {
		if (shouldYieldToMetroStation(event.point)) return;

		const padding = 6;
		const features = map.queryRenderedFeatures(
			[
				[event.point.x - padding, event.point.y - padding],
				[event.point.x + padding, event.point.y + padding],
			],
			{ layers: ["bus-routes"] },
		);
		const busRoutes = uniqueRouteFeatures(features);
		if (busRoutes.length === 0) return;
		const info = formatBusRouteHover(busRoutes, frequencies, travelTimes, true);
		pinController.pin(info, clearHover);
		setHoveredRoutes(busRoutes);
		popup.setLngLat(event.lngLat).setHTML(createPopupHtml(info)).addTo(map);
	};

	map.on("mousemove", "bus-routes", onMove);
	map.on("mouseleave", "bus-routes", clearHover);
	map.on("click", "bus-routes", onClick);

	return () => {
		map.off("mousemove", "bus-routes", onMove);
		map.off("mouseleave", "bus-routes", clearHover);
		map.off("click", "bus-routes", onClick);
		clearHover();
	};
}

/** Deduplica features por `route_key` y ordena por nombre corto del recorrido. */
function uniqueRouteFeatures(features: MapGeoJSONFeature[]) {
	const unique = new Map<string, MapGeoJSONFeature>();
	for (const feature of features) {
		const routeKey = getFeatureString(feature, "route_key");
		if (!routeKey || unique.has(routeKey)) continue;
		unique.set(routeKey, feature);
	}
	return [...unique.values()].sort((a, b) =>
		getFeatureString(a, "short_name").localeCompare(
			getFeatureString(b, "short_name"),
			"es",
			{ numeric: true },
		),
	);
}

function formatComunaHover(
	feature: MapGeoJSONFeature,
	pinned: boolean,
): Exclude<HoverInfo, null> {
	const comuna = getFeatureString(feature, "Comuna") || "Comuna";
	const provincia = getFeatureString(feature, "Provincia");
	const region = getFeatureString(feature, "Region");
	const code = getFeatureString(feature, "cod_comuna");
	const district = getFeatureString(feature, "dis_elec");
	const area = formatAreaKm2(getFeatureNumber(feature, "st_area_sh"));
	const details = [
		code ? `Código comuna ${code}` : "",
		district ? `Distrito electoral ${district}` : "",
		area ? `Área aprox. ${area}` : "",
	]
		.filter(Boolean)
		.map(String);

	return {
		kind: "Comuna RM",
		title: comuna,
		description: provincia ? `Provincia ${provincia}` : region,
		popupDescription: provincia || region || "Región Metropolitana",
		details,
		pinned,
		accent: COMUNA_COLOR,
	};
}

function formatAreaKm2(areaSquareMeters: number | null) {
	if (!areaSquareMeters) return "";
	return `${new Intl.NumberFormat("es-CL", {
		maximumFractionDigits: 1,
	}).format(areaSquareMeters / 1_000_000)} km²`;
}

/** Construye el contenido del popup para 1 o N recorridos de bus. */
function formatBusRouteHover(
	features: MapGeoJSONFeature[],
	frequencies: FrequencyMap | null,
	travelTimes: TravelTimeMap | null,
	pinned: boolean,
): Exclude<HoverInfo, null> {
	if (features.length === 1) {
		const feature = features[0] as MapGeoJSONFeature;
		const route = getFeatureString(feature, "short_name") || "Recorrido";
		const destination = getFeatureString(feature, "destination");
		const frequency = getFrequencyForFeature(feature, frequencies);
		const travelTime = getTravelTimeForFeature(feature, travelTimes);
		const routeName = formatBusRouteName(feature);
		const metrics = formatBusMetrics(frequency, travelTime);
		const description = destination
			? `Hacia ${destination}`
			: getFeatureString(feature, "long_name");
		const details = [
			travelTime ? formatTravelTime(travelTime) : "",
			frequency ? formatHeadway(frequency) : "",
			"Promedio día hábil",
		].filter(Boolean);

		return {
			kind: "Micro RED",
			title: route,
			description: description || "Recorrido de bus",
			popupTitle: routeName,
			popupDescription: metrics || description || "Recorrido de bus",
			details,
			pinned,
			accent: BUS_COLOR,
		};
	}

	const visibleRoutes = features.slice(0, 8).map((feature) => {
		return formatBusRouteName(feature);
	});
	const popupDescription = [
		`${features.length} recorridos seleccionados`,
		visibleRoutes.join(" · "),
	]
		.filter(Boolean)
		.join(" · ");
	const details = features.map((feature) => {
		const frequency = getFrequencyForFeature(feature, frequencies);
		const travelTime = getTravelTimeForFeature(feature, travelTimes);
		return [
			formatBusRouteName(feature),
			travelTime ? formatTravelTime(travelTime) : "Sin tiempo disponible",
			frequency ? formatHeadway(frequency) : "Sin frecuencia disponible",
		]
			.filter(Boolean)
			.join(" · ");
	});

	return {
		kind: "Micros RED",
		title: `${features.length} recorridos en este tramo`,
		description: "Recorridos que pasan por el tramo bajo el cursor",
		popupDescription,
		details,
		note: "Tiempos aprox. del recorrido completo · día hábil",
		pinned,
		accent: BUS_COLOR,
	};
}

function formatBusRouteName(feature: MapGeoJSONFeature) {
	const route = getFeatureString(feature, "short_name") || "Recorrido";
	const destination = getFeatureString(feature, "destination");
	return destination ? `${route} hacia ${destination}` : route;
}

function formatBusMetrics(
	frequency: FrequencyInfo | undefined,
	travelTime: TravelTimeInfo | undefined,
) {
	return [
		travelTime ? formatTravelTimeShort(travelTime) : "",
		frequency ? formatHeadwayShort(frequency) : "",
	]
		.filter(Boolean)
		.join(" · ");
}

function getFrequencyForFeature(
	feature: MapGeoJSONFeature,
	frequencies: FrequencyMap | null,
) {
	return findMetricForFeature(feature, frequencies);
}

function getTravelTimeForFeature(
	feature: MapGeoJSONFeature,
	travelTimes: TravelTimeMap | null,
) {
	return findMetricForFeature(feature, travelTimes);
}

function findMetricForFeature<T>(
	feature: MapGeoJSONFeature,
	metrics: Record<string, T> | null,
) {
	if (!metrics) return undefined;
	const keys = getMetricKeyCandidates(feature);
	for (const key of keys) {
		const metric = metrics[key];
		if (metric) return metric;
	}

	const normalizedKeys = new Set(keys.map(normalizeMetricKey));
	return Object.entries(metrics).find(([key]) =>
		normalizedKeys.has(normalizeMetricKey(key)),
	)?.[1];
}

function getMetricKeyCandidates(feature: MapGeoJSONFeature) {
	const routeKey = getFeatureString(feature, "route_key").trim();
	const routeId = getFeatureString(feature, "route_id").trim();
	const shortName = getFeatureString(feature, "short_name").trim();
	const directionId = getFeatureString(feature, "direction_id").trim();
	const destination = getFeatureString(feature, "destination").trim();
	const candidates = [routeKey, routeId, shortName];

	if (directionId && destination) {
		for (const route of [routeId, shortName]) {
			if (route) candidates.push(`${route}|${directionId}|${destination}`);
		}
	}

	return [...new Set(candidates.filter(Boolean))];
}

function normalizeMetricKey(key: string) {
	return key.trim().toLocaleLowerCase("es");
}

/**
 * Click de estaciones de metro: tap selecciona, zoom in, y muestra info.
 * Solo responde cuando `modeRef.current === "metro"`.
 */
export function setupMetroStationClick(
	map: MapLibreMap,
	pinController: HoverPinController,
	modeRef: { current: InteractionMode },
) {
	const onClick = (event: MapLayerMouseEvent) => {
		if (modeRef.current !== "metro") return;
		const feature = event.features?.[0];
		if (!feature) return;

		const name = getFeatureString(feature, "name");
		const lineName = getFeatureString(feature, "line_name");
		const lineColor = getFeatureString(feature, "line_color") || "#0f8f98";
		const stopId = getFeatureString(feature, "stop_id");
		const coords = (feature.geometry as GeoJSON.Point).coordinates as [
			number,
			number,
		];

		map.flyTo({ center: coords, zoom: 15, pitch: 45, duration: 650 });

		const info: Exclude<HoverInfo, null> = {
			kind: lineName || "Metro",
			title: name || "Estación",
			description: `Estación de ${lineName || "Metro de Santiago"}`,
			details: [stopId ? `Código: ${stopId}` : ""].filter(Boolean),
			pinned: true,
			accent: lineColor,
		};

		pinController.pin(info, () => {
			// No extra cleanup needed for metro stations
		});
	};

	map.on("click", "metro-stations", onClick);
	return () => {
		map.off("click", "metro-stations", onClick);
	};
}

/**
 * Interacción para ruido ambiental. Usa comunas completas para hover/tap y
 * mantiene los valores comunales aunque el cursor caiga en zonas sin relleno.
 */
export function setupNoiseInteraction(
	map: MapLibreMap,
	setHoverInfo: (info: HoverInfo) => void,
	pinController: HoverPinController,
) {
	const setLayerFilters = (
		layerIds: readonly string[],
		feature: MapGeoJSONFeature | null,
	) => {
		const comuna = feature ? getFeatureString(feature, "COMUNA") : null;
		const filter: FilterSpecification = comuna
			? ["==", ["get", "COMUNA"], comuna]
			: EMPTY_NOISE_COMUNA_FILTER;
		for (const layerId of layerIds) {
			if (map.getLayer(layerId)) map.setFilter(layerId, filter);
		}
	};
	const setHoverFilter = (feature: MapGeoJSONFeature | null) => {
		setLayerFilters(NOISE_COMUNA_HOVER_LAYER_IDS, feature);
	};
	const setSelectedFilter = (feature: MapGeoJSONFeature | null) => {
		setLayerFilters(
			[
				"noise-outline",
				...NOISE_SELECTED_ZONE_LAYER_IDS,
				...NOISE_COMUNA_SELECTED_LAYER_IDS,
			],
			feature,
		);
	};

	const onMove = (event: MapLayerMouseEvent) => {
		if (pinController.isPinned()) return;
		const feature = event.features?.[0];
		if (!feature) return;
		map.getCanvas().style.cursor = "pointer";
		setHoverFilter(feature);
	};

	const onLeave = () => {
		map.getCanvas().style.cursor = "";
		if (pinController.isPinned()) return;
		setHoverFilter(null);
	};

	const onClick = (event: MapLayerMouseEvent) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const info = formatNoiseHover(feature, true);
		setHoverFilter(null);
		pinController.pin(info, () => {
			setHoverFilter(null);
			setSelectedFilter(null);
			setHoverInfo(null);
		});
		setSelectedFilter(feature);
	};

	map.on("mousemove", NOISE_COMUNA_INTERACTION_LAYER_ID, onMove);
	map.on("mouseleave", NOISE_COMUNA_INTERACTION_LAYER_ID, onLeave);
	map.on("click", NOISE_COMUNA_INTERACTION_LAYER_ID, onClick);

	return () => {
		map.off("mousemove", NOISE_COMUNA_INTERACTION_LAYER_ID, onMove);
		map.off("mouseleave", NOISE_COMUNA_INTERACTION_LAYER_ID, onLeave);
		map.off("click", NOISE_COMUNA_INTERACTION_LAYER_ID, onClick);
		map.getCanvas().style.cursor = "";
		setHoverFilter(null);
		setSelectedFilter(null);
		if (!pinController.isPinned()) setHoverInfo(null);
	};
}

function formatNoiseHover(
	feature: MapGeoJSONFeature,
	pinned: boolean,
): Exclude<HoverInfo, null> {
	const dbPromedioComunal = getFeatureNumber(feature, "dbPromedioComunal");
	const dbMinComunal = getFeatureNumber(feature, "dbMinComunal");
	const dbMaxComunal = getFeatureNumber(feature, "dbMaxComunal");
	const dbLo = getFeatureNumber(feature, "DB_LO");
	const dbHi = getFeatureNumber(feature, "DB_HI");
	const comunaRaw = getFeatureString(feature, "COMUNA");

	const dbLabel =
		dbPromedioComunal !== null
			? `Promedio comunal: ${dbPromedioComunal.toFixed(1)} dB(A)`
			: dbLo !== null && dbHi !== null
				? `Zona de ruido: ${dbLo}-${dbHi} dB(A)`
				: "Promedio comunal no disponible";
	const accentColor = noiseDbColor(dbPromedioComunal ?? dbLo ?? 0);
	const comunaLabel = comunaRaw ? noiseToTitleCase(comunaRaw) : "Zona urbana";
	const observedRange =
		dbMinComunal !== null && dbMaxComunal !== null
			? `Rango observado: ${dbMinComunal}-${dbMaxComunal} dB(A)`
			: dbLo !== null && dbHi !== null
				? `Rango observado: ${dbLo}-${dbHi} dB(A)`
				: null;

	return {
		kind: "Ruido ambiental",
		title: comunaLabel,
		description: dbLabel,
		details: observedRange ? [observedRange] : [],
		accent: accentColor,
		pinned,
		...(dbPromedioComunal !== null ? { noiseDb: dbPromedioComunal } : {}),
	};
}

/** Convierte texto en mayúsculas a title-case: "SAN BERNARDO" → "San Bernardo". */
function noiseToTitleCase(text: string): string {
	return text
		.toLowerCase()
		.split(/\s+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/** Renderiza un popup-card consistente para cualquier `HoverInfo`. */
export function createPopupHtml(info: Exclude<HoverInfo, null>) {
	const title = info.popupTitle ?? info.title;
	const description = info.popupDescription ?? info.description;
	const descriptionHtml = description
		? `<p>${escapeHtml(description)}</p>`
		: "";
	const pinHint = !info.pinned
		? `<p class="popup-pin-hint">Click para fijar</p>`
		: "";
	return `<div class="popup-card" style="--accent:${escapeHtml(
		info.accent,
	)}"><span>${escapeHtml(info.kind)}</span><strong>${escapeHtml(
		title,
	)}</strong>${descriptionHtml}${pinHint}</div>`;
}
