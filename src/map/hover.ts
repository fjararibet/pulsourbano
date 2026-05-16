import type {
	MapGeoJSONFeature,
	MapLayerMouseEvent,
	Map as MapLibreMap,
	Popup,
} from "maplibre-gl";
import { BUS_COLOR, EMPTY_BUS_HOVER_FILTER } from "./config";
import type { FrequencyMap, HoverInfo } from "./types";
import { escapeHtml, formatHeadway, getFeatureString } from "./utils";

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
	frequencies: FrequencyMap | null,
) {
	const clearHover = () => {
		map.setFilter("bus-hover-lines", EMPTY_BUS_HOVER_FILTER);
		map.setFilter("bus-hover-arrows", EMPTY_BUS_HOVER_FILTER);
		map.getCanvas().style.cursor = "";
		popup.remove();
		setHoverInfo(null);
	};

	const onMove = (event: MapLayerMouseEvent) => {
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

		const info = formatBusRouteHover(busRoutes, frequencies);
		popup.setLngLat(event.lngLat).setHTML(createPopupHtml(info)).addTo(map);
		setHoverInfo(info);
	};

	map.on("mousemove", "bus-routes", onMove);
	map.on("mouseleave", "bus-routes", clearHover);

	return () => {
		map.off("mousemove", "bus-routes", onMove);
		map.off("mouseleave", "bus-routes", clearHover);
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
): Exclude<HoverInfo, null> {
	if (features.length === 1) {
		const feature = features[0];
		const route = getFeatureString(feature, "short_name") || "Recorrido";
		const routeId = getFeatureString(feature, "route_id");
		const destination = getFeatureString(feature, "destination");
		const frequency = routeId ? frequencies?.[routeId] : undefined;
		const description = [
			getFeatureString(feature, "long_name") || "Recorrido de bus",
			destination ? `Sentido: ${destination}` : "",
			frequency ? formatHeadway(frequency) : "",
		]
			.filter(Boolean)
			.join(" · ");

		return {
			kind: "Micro RED",
			title: route,
			description,
			accent: BUS_COLOR,
		};
	}

	const visibleRoutes = features.slice(0, 8).map((feature) => {
		const route = getFeatureString(feature, "short_name") || "Recorrido";
		const destination = getFeatureString(feature, "destination");
		return destination ? `${route} hacia ${destination}` : route;
	});
	const remaining = features.length - visibleRoutes.length;
	const description = [
		visibleRoutes.join(" · "),
		remaining > 0 ? `+${remaining} más` : "",
	]
		.filter(Boolean)
		.join(" · ");

	return {
		kind: "Micros RED",
		title: `${features.length} recorridos en este tramo`,
		description,
		accent: BUS_COLOR,
	};
}

/** Renderiza un popup-card consistente para cualquier `HoverInfo`. */
export function createPopupHtml(info: Exclude<HoverInfo, null>) {
	return `<div class="popup-card" style="--accent:${escapeHtml(
		info.accent,
	)}"><span>${escapeHtml(info.kind)}</span><strong>${escapeHtml(
		info.title,
	)}</strong><p>${escapeHtml(info.description)}</p></div>`;
}
