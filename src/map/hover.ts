import type {
	MapGeoJSONFeature,
	MapLayerMouseEvent,
	Map as MapLibreMap,
	Popup,
} from "maplibre-gl";
import { BUS_COLOR, EMPTY_BUS_HOVER_FILTER } from "./config";
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
	getFeatureString,
} from "./utils";

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
) {
	const onMove = (event: MapLayerMouseEvent) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const info = formatFeature(feature);
		map.getCanvas().style.cursor = "pointer";
		popup.setLngLat(event.lngLat).setHTML(createPopupHtml(info)).addTo(map);
		setHoverInfo(info);
	};

	const onLeave = () => {
		map.getCanvas().style.cursor = "";
		popup.remove();
		setHoverInfo(null);
	};

	map.on("mousemove", layerId, onMove);
	map.on("mouseleave", layerId, onLeave);

	return () => {
		map.off("mousemove", layerId, onMove);
		map.off("mouseleave", layerId, onLeave);
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
	setPinnedInfo: (info: HoverInfo | null) => void,
	onClearPinned: () => void,
	frequencies: FrequencyMap | null,
	travelTimes: TravelTimeMap | null,
) {
	let pinnedInfo: HoverInfo | null = null;

	const clearHover = () => {
		map.setFilter("bus-hover-lines", EMPTY_BUS_HOVER_FILTER);
		map.setFilter("bus-hover-arrows", EMPTY_BUS_HOVER_FILTER);
		map.getCanvas().style.cursor = "";
		popup.remove();
		if (!pinnedInfo) setHoverInfo(null);
	};

	const onMove = (event: MapLayerMouseEvent) => {
		if (pinnedInfo) return;
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

		const routeKeys = busRoutes
			.map((feature) => getFeatureString(feature, "route_key"))
			.filter(Boolean)
			.slice(0, 12);
		const hoverFilter = [
			"in",
			["get", "route_key"],
			["literal", routeKeys],
		] as const;

		map.setFilter("bus-hover-lines", hoverFilter);
		map.setFilter("bus-hover-arrows", hoverFilter);
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
		pinnedInfo = info;
		setPinnedInfo(info);
		setHoverInfo(info);
	};

	const _clearPinnedInfo = () => {
		if (!pinnedInfo) return;
		pinnedInfo = null;
		clearHover();
		setHoverInfo(null);
		onClearPinned();
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

/** Construye el contenido del popup para 1 o N recorridos de bus. */
function formatBusRouteHover(
	features: MapGeoJSONFeature[],
	frequencies: FrequencyMap | null,
	travelTimes: TravelTimeMap | null,
	pinned: boolean,
): Exclude<HoverInfo, null> {
	if (features.length === 1) {
		const feature = features[0];
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
	const remaining = features.length - visibleRoutes.length;
	const popupDescription = [
		visibleRoutes.join(" · "),
		remaining > 0 ? `+${remaining} más` : "",
	]
		.filter(Boolean)
		.join(" · ");
	const detailFeatures = features.slice(0, 3);
	const details = detailFeatures.map((feature) => {
		const frequency = getFrequencyForFeature(feature, frequencies);
		const travelTime = getTravelTimeForFeature(feature, travelTimes);
		return [
			formatBusRouteName(feature),
			formatBusMetrics(frequency, travelTime),
		]
			.filter(Boolean)
			.join(" · ");
	});
	const hiddenDetails = features.length - detailFeatures.length;
	if (hiddenDetails > 0) details.push(`+${hiddenDetails} más`);

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
	if (!frequencies) return undefined;
	const routeKey = getFeatureString(feature, "route_key");
	const routeId = getFeatureString(feature, "route_id");
	return (
		(routeKey ? frequencies[routeKey] : undefined) ??
		(routeId ? frequencies[routeId] : undefined)
	);
}

function getTravelTimeForFeature(
	feature: MapGeoJSONFeature,
	travelTimes: TravelTimeMap | null,
) {
	if (!travelTimes) return undefined;
	const routeKey = getFeatureString(feature, "route_key");
	const routeId = getFeatureString(feature, "route_id");
	return (
		(routeKey ? travelTimes[routeKey] : undefined) ??
		(routeId ? travelTimes[routeId] : undefined)
	);
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
