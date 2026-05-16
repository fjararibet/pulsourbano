import type {
	FilterSpecification,
	MapGeoJSONFeature,
	MapLayerMouseEvent,
	Map as MapLibreMap,
	Popup,
} from "maplibre-gl";
import {
	BUS_COLOR,
	COMUNA_COLOR,
	EMPTY_BUS_HOVER_FILTER,
	EMPTY_COMUNA_HOVER_FILTER,
} from "./config";
import type {
	FrequencyInfo,
	FrequencyMap,
	HoverInfo,
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

const COMUNA_HOVER_LAYERS = ["comunas-hover-fill", "comunas-hover-outline"];
const COMUNA_PRIORITY_LAYERS = [
	"bus-routes",
	"bus-stops",
	"metro-lines",
	"metro-stations",
	"cycleway-lines",
];

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
) {
	const onMove = (event: MapLayerMouseEvent) => {
		if (pinController.isPinned()) return;
		const feature = event.features?.[0];
		if (!feature) return;
		const info = formatFeature(feature);
		map.getCanvas().style.cursor = "pointer";
		popup.setLngLat(event.lngLat).setHTML(createPopupHtml(info)).addTo(map);
		setHoverInfo(info);
	};

	const onLeave = () => {
		if (pinController.isPinned()) return;
		map.getCanvas().style.cursor = "";
		popup.remove();
		setHoverInfo(null);
	};

	const onClick = (event: MapLayerMouseEvent) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const info = { ...formatFeature(feature), pinned: true };
		pinController.pin(info, () => {
			map.getCanvas().style.cursor = "";
			popup.remove();
		});
		map.getCanvas().style.cursor = "pointer";
		popup.setLngLat(event.lngLat).setHTML(createPopupHtml(info)).addTo(map);
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
 * Hover/click de comunas. Tiene prioridad baja para no tapar las capas de
 * transporte, ya que el polígono comunal cubre prácticamente todo el mapa.
 */
export function setupComunaHover(
	map: MapLibreMap,
	popup: Popup,
	setHoverInfo: (info: HoverInfo) => void,
	pinController: HoverPinController,
) {
	let activeCode: number | null = null;

	const setComunaFilter = (feature: MapGeoJSONFeature | null) => {
		const comunaCode = feature ? getFeatureNumber(feature, "cod_comuna") : null;
		activeCode = comunaCode;
		const filter: FilterSpecification = comunaCode
			? ["==", ["get", "cod_comuna"], comunaCode]
			: EMPTY_COMUNA_HOVER_FILTER;

		for (const layerId of COMUNA_HOVER_LAYERS) {
			if (map.getLayer(layerId)) map.setFilter(layerId, filter);
		}
	};

	const clearComunaEffects = () => {
		setComunaFilter(null);
		map.getCanvas().style.cursor = "";
		popup.remove();
	};

	const clearHover = () => {
		if (activeCode === null) return;
		clearComunaEffects();
		if (!pinController.isPinned()) setHoverInfo(null);
	};

	const shouldYieldToTransport = (point: MapLayerMouseEvent["point"]) => {
		const layers = COMUNA_PRIORITY_LAYERS.filter((layerId) =>
			map.getLayer(layerId),
		);
		if (layers.length === 0) return false;
		const padding = 5;
		const features = map.queryRenderedFeatures(
			[
				[point.x - padding, point.y - padding],
				[point.x + padding, point.y + padding],
			],
			{ layers },
		);
		return features.length > 0;
	};

	const onMove = (event: MapLayerMouseEvent) => {
		if (pinController.isPinned()) return;
		if (shouldYieldToTransport(event.point)) {
			clearHover();
			return;
		}

		const feature = event.features?.[0];
		if (!feature) return;
		const info = formatComunaHover(feature, false);
		setComunaFilter(feature);
		map.getCanvas().style.cursor = "pointer";
		popup.setLngLat(event.lngLat).setHTML(createPopupHtml(info)).addTo(map);
		setHoverInfo(info);
	};

	const onClick = (event: MapLayerMouseEvent) => {
		if (shouldYieldToTransport(event.point)) return;
		const feature = event.features?.[0];
		if (!feature) return;
		const info = formatComunaHover(feature, true);
		setComunaFilter(feature);
		pinController.pin(info, clearComunaEffects);
		map.getCanvas().style.cursor = "pointer";
		popup.setLngLat(event.lngLat).setHTML(createPopupHtml(info)).addTo(map);
	};

	map.on("mousemove", "comunas-fill", onMove);
	map.on("mouseleave", "comunas-fill", clearHover);
	map.on("click", "comunas-fill", onClick);

	return () => {
		map.off("mousemove", "comunas-fill", onMove);
		map.off("mouseleave", "comunas-fill", clearHover);
		map.off("click", "comunas-fill", onClick);
		clearComunaEffects();
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
		map.getCanvas().style.cursor = "";
		popup.remove();
		if (!pinController.isPinned()) setHoverInfo(null);
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
		map.getCanvas().style.cursor = "pointer";

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
		map.getCanvas().style.cursor = "pointer";
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
