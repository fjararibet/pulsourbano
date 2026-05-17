import type {
	ExpressionSpecification,
	FilterSpecification,
	GeoJSONSource,
	Map as MapLibreMap,
} from "maplibre-gl";
import {
	BUS_ARROW_ICON_ID,
	BUS_COLOR,
	COMUNA_COLOR,
	COMUNA_DESTINO_LAYER_IDS,
	COMUNA_INTERACTION_LAYER_ID,
	COMUNA_ORIGEN_LAYER_IDS,
	COMUNA_SELECTED_COLOR,
	COMUNA_SELECTED_LAYER_IDS,
	DESTINO_COLOR,
	EMPTY_BUS_HOVER_FILTER,
	EMPTY_COMUNA_HOVER_FILTER,
	EMPTY_COMUNA_NAME_FILTER,
	LAYER_TOGGLES,
	LOGICAL_LAYERS,
	OD_ARROW_ICON_ID,
	OD_COLOR,
	OD_SOURCE_ID,
	ORIGEN_COLOR,
	ROUTE_ARROW_COLOR,
	ROUTE_ARROW_CORE_LAYER_BY_MODE,
	ROUTE_ARROW_ICON_ID,
	ROUTE_ARROW_LAYER_IDS,
	ROUTE_ARROW_SOURCE_ID,
} from "./config";
import type { LayerVisibility } from "./types";

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
	type: "FeatureCollection",
	features: [],
};

const SIMULATION_IMPACT_SOURCE_ID = "simulation-impact";

/** Límites comunales RM: relleno suave, borde y resaltado interactivo. */
export function addComunaLayers(
	map: MapLibreMap,
	data: GeoJSON.FeatureCollection,
) {
	map.addSource("comunas-rm", { type: "geojson", data });
	map.addLayer({
		id: "comunas-fill",
		type: "fill",
		source: "comunas-rm",
		paint: {
			"fill-color": COMUNA_COLOR,
			"fill-opacity": 0,
		},
	});
	map.addLayer({
		id: "comunas-outline",
		type: "line",
		source: "comunas-rm",
		paint: {
			"line-color": COMUNA_COLOR,
			"line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 13, 5],
			"line-opacity": 0.6,
		},
	});
	map.addLayer({
		id: COMUNA_INTERACTION_LAYER_ID,
		type: "fill",
		source: "comunas-rm",
		paint: {
			"fill-color": COMUNA_COLOR,
			"fill-opacity": 0,
		},
	});
	map.addLayer({
		id: "comunas-selected-fill",
		type: "fill",
		source: "comunas-rm",
		filter: EMPTY_COMUNA_HOVER_FILTER,
		paint: {
			"fill-color": COMUNA_SELECTED_COLOR,
			"fill-opacity": 0.45,
		},
	});
	map.addLayer({
		id: "comunas-selected-outline",
		type: "line",
		source: "comunas-rm",
		filter: EMPTY_COMUNA_HOVER_FILTER,
		paint: {
			"line-color": COMUNA_SELECTED_COLOR,
			"line-width": ["interpolate", ["linear"], ["zoom"], 9, 3, 13, 5],
			"line-opacity": 1,
		},
	});
	map.addLayer({
		id: "comunas-origen-fill",
		type: "fill",
		source: "comunas-rm",
		filter: EMPTY_COMUNA_NAME_FILTER,
		paint: {
			"fill-color": ORIGEN_COLOR,
			"fill-opacity": 0.35,
		},
	});
	map.addLayer({
		id: "comunas-origen-outline",
		type: "line",
		source: "comunas-rm",
		filter: EMPTY_COMUNA_NAME_FILTER,
		paint: {
			"line-color": ORIGEN_COLOR,
			"line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 13, 3],
			"line-opacity": 1,
		},
	});
	map.addLayer({
		id: "comunas-destino-fill",
		type: "fill",
		source: "comunas-rm",
		filter: EMPTY_COMUNA_NAME_FILTER,
		paint: {
			"fill-color": DESTINO_COLOR,
			"fill-opacity": 0.35,
		},
	});
	map.addLayer({
		id: "comunas-destino-outline",
		type: "line",
		source: "comunas-rm",
		filter: EMPTY_COMUNA_NAME_FILTER,
		paint: {
			"line-color": DESTINO_COLOR,
			"line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 13, 3],
			"line-opacity": 1,
		},
	});
}

/** Mantiene el resaltado de comuna por encima de las demás capas. */
export function bringComunaHoverToFront(map: MapLibreMap) {
	for (const layerId of COMUNA_SELECTED_LAYER_IDS) {
		if (map.getLayer(layerId)) map.moveLayer(layerId);
	}
	for (const layerId of COMUNA_ORIGEN_LAYER_IDS) {
		if (map.getLayer(layerId)) map.moveLayer(layerId);
	}
	for (const layerId of COMUNA_DESTINO_LAYER_IDS) {
		if (map.getLayer(layerId)) map.moveLayer(layerId);
	}
	if (map.getLayer(COMUNA_INTERACTION_LAYER_ID)) {
		map.moveLayer(COMUNA_INTERACTION_LAYER_ID);
	}
}

/** Actualiza los filtros de las capas de origen y destino. */
export function updateComunaSelectionLayers(
	map: MapLibreMap,
	origen: string | null,
	destino: string | null,
) {
	const origenFilter: FilterSpecification = origen
		? ["==", ["get", "Comuna"], origen]
		: EMPTY_COMUNA_NAME_FILTER;
	const destinoFilter: FilterSpecification = destino
		? ["==", ["get", "Comuna"], destino]
		: EMPTY_COMUNA_NAME_FILTER;

	for (const layerId of COMUNA_ORIGEN_LAYER_IDS) {
		if (map.getLayer(layerId)) map.setFilter(layerId, origenFilter);
	}
	for (const layerId of COMUNA_DESTINO_LAYER_IDS) {
		if (map.getLayer(layerId)) map.setFilter(layerId, destinoFilter);
	}
}

/** Capas de flecha de ruta origen-destino con efecto 3D (sombra, glow, animación). */
export function addRouteArrowLayers(map: MapLibreMap) {
	if (map.getSource(ROUTE_ARROW_SOURCE_ID)) return;

	map.addSource(ROUTE_ARROW_SOURCE_ID, {
		type: "geojson",
		data: EMPTY_FEATURE_COLLECTION,
		lineMetrics: true,
	});

	ensureRouteArrowIcon(map);

	// Each layer multiplies the feature's `thickness` (usage signal) by a
	// zoom-driven base width, so a heavier route is wider at every zoom.
	// `["zoom"]` must sit at the top of the expression tree, so we put `*`
	// inside the interpolate stops rather than wrapping interpolate in `*`.
	const thicknessScale = (low: number, high: number): ExpressionSpecification =>
		[
			"interpolate",
			["linear"],
			["zoom"],
			10,
			["*", ["coalesce", ["get", "thickness"], 3], low],
			14,
			["*", ["coalesce", ["get", "thickness"], 3], high],
		] as unknown as ExpressionSpecification;

	map.addLayer({
		id: "route-arrow-shadow",
		type: "line",
		source: ROUTE_ARROW_SOURCE_ID,
		filter: ["==", ["geometry-type"], "LineString"],
		paint: {
			"line-color": ["get", "color"],
			"line-width": thicknessScale(2.4, 4.8),
			"line-opacity": 0.2,
			"line-blur": 8,
		},
	});

	map.addLayer({
		id: "route-arrow-glow",
		type: "line",
		source: ROUTE_ARROW_SOURCE_ID,
		filter: ["==", ["geometry-type"], "LineString"],
		paint: {
			"line-color": ["get", "color"],
			"line-width": thicknessScale(1.8, 3.6),
			"line-opacity": 0.45,
			"line-blur": 6,
		},
	});

	map.addLayer({
		id: "route-arrow-base",
		type: "line",
		source: ROUTE_ARROW_SOURCE_ID,
		filter: ["==", ["geometry-type"], "LineString"],
		layout: {
			"line-cap": "round",
			"line-join": "round",
		},
		paint: {
			"line-color": ["get", "color"],
			"line-width": thicknessScale(0.75, 1.5),
			"line-opacity": 0.65,
		},
	});

	// One core layer per mode — `line-gradient` doesn't support data-driven
	// expressions, so each mode needs its own layer to pulse at its own speed.
	for (const [mode, layerId] of Object.entries(ROUTE_ARROW_CORE_LAYER_BY_MODE)) {
		map.addLayer({
			id: layerId,
			type: "line",
			source: ROUTE_ARROW_SOURCE_ID,
			filter: [
				"all",
				["==", ["geometry-type"], "LineString"],
				["==", ["get", "mode"], mode],
			],
			layout: {
				"line-cap": "round",
				"line-join": "round",
			},
			paint: {
				"line-color": ["get", "color"],
				"line-gradient": createRouteArrowGradient(0.5, "#ffffff"),
				"line-width": thicknessScale(1.05, 2.1),
				"line-opacity": 0.95,
			},
		});
	}

	map.addLayer({
		id: "route-arrow-symbols",
		type: "symbol",
		source: ROUTE_ARROW_SOURCE_ID,
		filter: ["==", ["geometry-type"], "LineString"],
		layout: {
			"symbol-placement": "line",
			"symbol-spacing": 140,
			"icon-image": ROUTE_ARROW_ICON_ID,
			"icon-rotation-alignment": "map",
			"icon-keep-upright": false,
			"icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 14, 1.2],
			"icon-allow-overlap": true,
			"icon-ignore-placement": true,
		},
		paint: {
			"icon-color": ["get", "color"],
			"icon-opacity": 0.9,
		},
	});
}

export function updateRouteArrowData(
	map: MapLibreMap,
	data: GeoJSON.FeatureCollection,
) {
	const source = map.getSource(ROUTE_ARROW_SOURCE_ID);
	if (source && "setData" in source) {
		(source as GeoJSONSource).setData(data);
	}
}

export function clearRouteArrow(map: MapLibreMap) {
	updateRouteArrowData(map, EMPTY_FEATURE_COLLECTION);
}

export function bringRouteArrowToFront(map: MapLibreMap) {
	for (const layerId of ROUTE_ARROW_LAYER_IDS) {
		if (map.getLayer(layerId)) map.moveLayer(layerId);
	}
}

/** IDs de iconos de flecha por color. */
export function ensureRouteArrowIcon(map: MapLibreMap) {
	if (map.hasImage(ROUTE_ARROW_ICON_ID)) return;

	const pixelRatio = 2;
	const width = 32;
	const height = 24;
	const canvas = document.createElement("canvas");
	canvas.width = width * pixelRatio;
	canvas.height = height * pixelRatio;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	ctx.scale(pixelRatio, pixelRatio);
	ctx.fillStyle = "#f59e0b";
	ctx.beginPath();
	ctx.moveTo(2, 6);
	ctx.lineTo(24, 12);
	ctx.lineTo(2, 18);
	ctx.lineTo(7, 12);
	ctx.closePath();
	ctx.fill();

	ctx.strokeStyle = "rgba(255,255,255,0.92)";
	ctx.lineWidth = 1.6;
	ctx.stroke();

	map.addImage(
		ROUTE_ARROW_ICON_ID,
		ctx.getImageData(0, 0, canvas.width, canvas.height),
		{ pixelRatio },
	);
}

/** Inicia la animación de gradiente que fluye a lo largo de la flecha. */
export function startRouteArrowAnimation(map: MapLibreMap) {
	let frameId = 0;
	const startedAt = performance.now();

	const animate = (time: number) => {
		const elapsedSeconds = (time - startedAt) / 1000;
		const waveProgress = (elapsedSeconds % 1.8) / 1.8;

		setPaintPropertyIfLayerExists(
			map,
			"route-arrow-core",
			"line-gradient",
			createRouteArrowGradient(waveProgress, ROUTE_ARROW_COLOR),
		);

		frameId = requestAnimationFrame(animate);
	};

	frameId = requestAnimationFrame(animate);
	return () => cancelAnimationFrame(frameId);
}

function createRouteArrowGradient(
	progress: number,
	color: string,
): ExpressionSpecification {
	return [
		"interpolate",
		["linear"],
		["line-progress"],
		0,
		hexToRgba(color, 0),
		Math.max(0, progress - 0.14),
		hexToRgba(color, 0),
		Math.max(0, progress - 0.05),
		hexToRgba(color, 0.35),
		progress,
		hexToRgba(color, 0.95),
		Math.min(1, progress + 0.05),
		hexToRgba(color, 0.35),
		Math.min(1, progress + 0.14),
		hexToRgba(color, 0),
		1,
		hexToRgba(color, 0),
	] as ExpressionSpecification;
}

/** Capas del Metro: halo blanco, línea coloreada y estaciones. */
export function addMetroLayers(
	map: MapLibreMap,
	data: GeoJSON.FeatureCollection,
) {
	map.addSource("metro", { type: "geojson", data });
	map.addLayer({
		id: "metro-line-halo",
		type: "line",
		source: "metro",
		filter: ["==", ["geometry-type"], "LineString"],
		paint: {
			"line-color": "rgba(255,255,255,0.76)",
			"line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 13, 8, 15, 12],
			"line-opacity": 0.86,
		},
	});
	map.addLayer({
		id: "metro-lines",
		type: "line",
		source: "metro",
		filter: ["==", ["geometry-type"], "LineString"],
		paint: {
			"line-color": ["coalesce", ["get", "color"], "#0f8f98"],
			"line-width": [
				"interpolate",
				["linear"],
				["zoom"],
				10,
				2.8,
				13,
				4.6,
				15,
				7,
			],
			"line-opacity": 0.95,
		},
	});
	map.addLayer({
		id: "metro-stations",
		type: "circle",
		source: "metro",
		filter: ["==", ["geometry-type"], "Point"],
		paint: {
			"circle-radius": [
				"interpolate",
				["linear"],
				["zoom"],
				10,
				3,
				13,
				5,
				15,
				7,
			],
			"circle-color": "#102f37",
			"circle-stroke-width": [
				"interpolate",
				["linear"],
				["zoom"],
				10,
				1.6,
				14,
				2.4,
			],
			"circle-stroke-color": "#ffffff",
			"circle-opacity": 0.94,
		},
	});
}

/**
 * Capas de buses RED: recorridos base + flechas direccionales + capas "hover"
 * (resaltado al pasar el cursor) + paraderos.
 */
export function addBusLayers(
	map: MapLibreMap,
	data: GeoJSON.FeatureCollection,
) {
	map.addSource("buses", { type: "geojson", data });
	ensureBusArrowIcon(map);

	map.addLayer({
		id: "bus-routes",
		type: "line",
		source: "buses",
		filter: ["==", ["geometry-type"], "LineString"],
		paint: {
			"line-color": BUS_COLOR,
			"line-width": [
				"interpolate",
				["linear"],
				["zoom"],
				10,
				0.35,
				13,
				1,
				15,
				2.4,
			],
			"line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.16, 14, 0.32],
		},
	});
	map.addLayer({
		id: "bus-route-arrows",
		type: "symbol",
		source: "buses",
		filter: ["==", ["geometry-type"], "LineString"],
		minzoom: 11,
		layout: {
			"symbol-placement": "line",
			"symbol-spacing": 320,
			"icon-image": BUS_ARROW_ICON_ID,
			"icon-rotation-alignment": "map",
			"icon-keep-upright": false,
			"icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.78, 15, 1.08],
			"icon-allow-overlap": true,
			"icon-ignore-placement": true,
		},
		paint: {
			"icon-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.38, 15, 0.5],
		},
	});
	map.addLayer({
		id: "bus-hover-lines",
		type: "line",
		source: "buses",
		filter: EMPTY_BUS_HOVER_FILTER,
		paint: {
			"line-color": BUS_COLOR,
			"line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.2, 14, 5.4],
			"line-opacity": 0.92,
		},
	});
	map.addLayer({
		id: "bus-hover-arrows",
		type: "symbol",
		source: "buses",
		filter: EMPTY_BUS_HOVER_FILTER,
		layout: {
			"symbol-placement": "line",
			"symbol-spacing": 130,
			"icon-image": BUS_ARROW_ICON_ID,
			"icon-rotation-alignment": "map",
			"icon-keep-upright": false,
			"icon-size": ["interpolate", ["linear"], ["zoom"], 10, 1.05, 15, 1.42],
			"icon-allow-overlap": true,
			"icon-ignore-placement": true,
		},
		paint: {
			"icon-opacity": 0.88,
		},
	});
	map.addLayer({
		id: "bus-stops",
		type: "circle",
		source: "buses",
		filter: [
			"all",
			["==", ["geometry-type"], "Point"],
			["==", ["get", "stop_kind"], "bus_stop"],
		],
		minzoom: 13,
		paint: {
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2, 15, 4],
			"circle-color": "#f2a900",
			"circle-stroke-width": 1.2,
			"circle-stroke-color": "#ffffff",
			"circle-opacity": 0.86,
		},
	});
}

/**
 * Pinta el ícono de flecha que se usa sobre los recorridos de bus.
 * Se dibuja en un canvas con doble densidad para que quede crujiente en retina.
 */
export function ensureBusArrowIcon(map: MapLibreMap) {
	if (map.hasImage(BUS_ARROW_ICON_ID)) return;

	const pixelRatio = 2;
	const width = 32;
	const height = 16;
	const canvas = document.createElement("canvas");
	canvas.width = width * pixelRatio;
	canvas.height = height * pixelRatio;
	const context = canvas.getContext("2d");
	if (!context) return;

	context.scale(pixelRatio, pixelRatio);
	context.lineCap = "round";
	context.lineJoin = "round";
	context.lineWidth = 3;
	context.strokeStyle = "rgba(255,255,255,0.92)";
	context.beginPath();
	context.moveTo(5, 8);
	context.lineTo(23, 8);
	context.moveTo(18, 3.5);
	context.lineTo(27, 8);
	context.lineTo(18, 12.5);
	context.stroke();

	context.strokeStyle = BUS_COLOR;
	context.lineWidth = 1.7;
	context.beginPath();
	context.moveTo(5, 8);
	context.lineTo(23, 8);
	context.moveTo(18, 3.5);
	context.lineTo(27, 8);
	context.lineTo(18, 12.5);
	context.stroke();

	map.addImage(
		BUS_ARROW_ICON_ID,
		context.getImageData(0, 0, canvas.width, canvas.height),
		{ pixelRatio },
	);
}

/** Capa de ciclovías OCUC, en líneas verdes punteadas. */
export function addCyclewayLayers(
	map: MapLibreMap,
	data: GeoJSON.FeatureCollection,
) {
	map.addSource("cycleways", { type: "geojson", data });
	map.addLayer({
		id: "cycleway-lines",
		type: "line",
		source: "cycleways",
		paint: {
			"line-color": "#10a56f",
			"line-width": [
				"interpolate",
				["linear"],
				["zoom"],
				10,
				1.2,
				13,
				2.4,
				15,
				4,
			],
			"line-opacity": 0.82,
			"line-dasharray": [1.6, 1.1],
		},
	});
}

/** Capas de evento espacial: radio, punto seleccionado, alternativas y enlaces. */
export function addSimulationImpactLayers(map: MapLibreMap) {
	if (!map.getSource(SIMULATION_IMPACT_SOURCE_ID)) {
		map.addSource(SIMULATION_IMPACT_SOURCE_ID, {
			type: "geojson",
			data: EMPTY_FEATURE_COLLECTION,
			lineMetrics: true,
		});
	}

	map.addLayer({
		id: "simulation-radius-fill",
		type: "fill",
		source: SIMULATION_IMPACT_SOURCE_ID,
		filter: ["==", ["get", "impact_kind"], "radius"],
		paint: {
			"fill-color": ["coalesce", ["get", "accent"], "#d75235"],
			"fill-opacity": 0.1,
		},
	});
	map.addLayer({
		id: "simulation-radius-outline",
		type: "line",
		source: SIMULATION_IMPACT_SOURCE_ID,
		filter: ["==", ["get", "impact_kind"], "radius"],
		paint: {
			"line-color": ["coalesce", ["get", "accent"], "#d75235"],
			"line-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 15, 4],
			"line-opacity": 0.42,
			"line-dasharray": [1.6, 1.4],
		},
	});
	map.addLayer({
		id: "simulation-flow-branches-glow",
		type: "line",
		source: SIMULATION_IMPACT_SOURCE_ID,
		filter: ["==", ["get", "impact_kind"], "link"],
		layout: {
			"line-cap": "round",
			"line-join": "round",
		},
		paint: {
			"line-color": ["coalesce", ["get", "accent"], "#d75235"],
			"line-width": ["interpolate", ["linear"], ["zoom"], 11, 3.8, 15, 8.5],
			"line-opacity": 0.12,
			"line-blur": 4.5,
		},
	});
	map.addLayer({
		id: "simulation-flow-branches",
		type: "line",
		source: SIMULATION_IMPACT_SOURCE_ID,
		filter: ["==", ["get", "impact_kind"], "link"],
		layout: {
			"line-cap": "round",
			"line-join": "round",
		},
		paint: {
			"line-color": ["coalesce", ["get", "accent"], "#d75235"],
			"line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.9, 15, 2.2],
			"line-opacity": 0.24,
		},
	});
	map.addLayer({
		id: "simulation-flow-wave",
		type: "line",
		source: SIMULATION_IMPACT_SOURCE_ID,
		filter: ["==", ["get", "impact_kind"], "link"],
		layout: {
			"line-cap": "round",
			"line-join": "round",
		},
		paint: {
			"line-gradient": createFlowWaveGradient(0.18, "#d75235"),
			"line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.7, 15, 3.8],
			"line-opacity": 0.92,
			"line-blur": 0.4,
		},
	});
	map.addLayer({
		id: "simulation-nearby-bus-stops",
		type: "circle",
		source: SIMULATION_IMPACT_SOURCE_ID,
		filter: ["==", ["get", "impact_kind"], "nearby-bus-stop"],
		paint: {
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2.2, 15, 4.6],
			"circle-color": "#f2a900",
			"circle-stroke-color": "#ffffff",
			"circle-stroke-width": 1.4,
			"circle-opacity": 0.74,
		},
	});
	map.addLayer({
		id: "simulation-nearby-stations",
		type: "circle",
		source: SIMULATION_IMPACT_SOURCE_ID,
		filter: ["==", ["get", "impact_kind"], "nearby-station"],
		paint: {
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 5, 15, 8],
			"circle-color": ["coalesce", ["get", "accent"], "#d75235"],
			"circle-stroke-color": ["coalesce", ["get", "accent"], "#d75235"],
			"circle-stroke-width": 2.2,
			"circle-stroke-opacity": 0.7,
			"circle-opacity": 0.18,
		},
	});
	map.addLayer({
		id: "simulation-selected-halo",
		type: "circle",
		source: SIMULATION_IMPACT_SOURCE_ID,
		filter: ["==", ["get", "impact_kind"], "selected-station"],
		paint: {
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 16, 15, 28],
			"circle-color": ["coalesce", ["get", "accent"], "#d75235"],
			"circle-opacity": 0.18,
		},
	});
	map.addLayer({
		id: "simulation-selected-core",
		type: "circle",
		source: SIMULATION_IMPACT_SOURCE_ID,
		filter: ["==", ["get", "impact_kind"], "selected-station"],
		paint: {
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 6, 15, 10],
			"circle-color": ["coalesce", ["get", "accent"], "#d75235"],
			"circle-stroke-color": "#ffffff",
			"circle-stroke-width": 2.8,
			"circle-opacity": 1,
		},
	});
}

export function setSimulationImpactData(
	map: MapLibreMap,
	data: GeoJSON.FeatureCollection,
) {
	getSimulationImpactSource(map)?.setData(data);
}

export function clearSimulationImpact(map: MapLibreMap) {
	setSimulationImpactData(map, EMPTY_FEATURE_COLLECTION);
}

function getSimulationImpactSource(map: MapLibreMap) {
	const source = map.getSource(SIMULATION_IMPACT_SOURCE_ID);
	return source && "setData" in source ? (source as GeoJSONSource) : null;
}

export function startSimulationImpactAnimation(
	map: MapLibreMap,
	accent: string,
) {
	let frameId = 0;
	const startedAt = performance.now();

	const animate = (time: number) => {
		const elapsedSeconds = (time - startedAt) / 1_000;
		const breath = (Math.sin((elapsedSeconds / 2.8) * Math.PI * 2) + 1) / 2;
		const waveProgress = 0.18 + 0.64 * ((elapsedSeconds % 3.4) / 3.4);

		setPaintPropertyIfLayerExists(
			map,
			"simulation-flow-wave",
			"line-gradient",
			createFlowWaveGradient(waveProgress, accent),
		);
		setPaintPropertyIfLayerExists(
			map,
			"simulation-selected-halo",
			"circle-radius",
			[
				"interpolate",
				["linear"],
				["zoom"],
				11,
				17 + breath * 8,
				15,
				28 + breath * 14,
			],
		);
		setPaintPropertyIfLayerExists(
			map,
			"simulation-selected-halo",
			"circle-opacity",
			0.11 + (1 - breath) * 0.15,
		);
		setPaintPropertyIfLayerExists(
			map,
			"simulation-radius-fill",
			"fill-opacity",
			0.075 + breath * 0.035,
		);
		setPaintPropertyIfLayerExists(
			map,
			"simulation-radius-outline",
			"line-opacity",
			0.3 + breath * 0.16,
		);
		setPaintPropertyIfLayerExists(
			map,
			"simulation-flow-branches-glow",
			"line-opacity",
			0.09 + breath * 0.045,
		);
		setPaintPropertyIfLayerExists(
			map,
			"simulation-nearby-stations",
			"circle-opacity",
			0.14 + breath * 0.1,
		);

		frameId = requestAnimationFrame(animate);
	};

	frameId = requestAnimationFrame(animate);
	return () => cancelAnimationFrame(frameId);
}

function setPaintPropertyIfLayerExists(
	map: MapLibreMap,
	layerId: string,
	property: string,
	value: unknown,
) {
	if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, value);
}

function createFlowWaveGradient(
	progress: number,
	accent: string,
): ExpressionSpecification {
	return [
		"interpolate",
		["linear"],
		["line-progress"],
		0,
		hexToRgba(accent, 0),
		Math.max(0, progress - 0.12),
		hexToRgba(accent, 0),
		Math.max(0, progress - 0.045),
		hexToRgba(accent, 0.32),
		progress,
		hexToRgba(accent, 0.92),
		Math.min(1, progress + 0.045),
		hexToRgba(accent, 0.32),
		Math.min(1, progress + 0.12),
		hexToRgba(accent, 0),
		1,
		hexToRgba(accent, 0),
	] as ExpressionSpecification;
}

function hexToRgba(hex: string, alpha: number) {
	const normalized = hex.replace("#", "");
	const value = /^[0-9a-f]{6}$/i.test(normalized) ? normalized : "d75235";
	const red = Number.parseInt(value.slice(0, 2), 16);
	const green = Number.parseInt(value.slice(2, 4), 16);
	const blue = Number.parseInt(value.slice(4, 6), 16);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/** Dibuja el ícono de flecha naranja para flujos OD. */
export function ensureODArrowIcon(map: MapLibreMap) {
	if (map.hasImage(OD_ARROW_ICON_ID)) return;

	const pixelRatio = 2;
	const width = 32;
	const height = 16;
	const canvas = document.createElement("canvas");
	canvas.width = width * pixelRatio;
	canvas.height = height * pixelRatio;
	const context = canvas.getContext("2d");
	if (!context) return;

	const cx = width / 2;
	const cy = height / 2;

	context.scale(pixelRatio, pixelRatio);
	context.lineCap = "round";
	context.lineJoin = "round";
	context.lineWidth = 2.5;
	context.strokeStyle = "rgba(255,255,255,0.9)";
	context.beginPath();
	context.moveTo(cx - 8, cy);
	context.lineTo(cx + 12, cy);
	context.moveTo(cx + 4, cy - 3.5);
	context.lineTo(cx + 14, cy);
	context.lineTo(cx + 4, cy + 3.5);
	context.stroke();

	context.strokeStyle = OD_COLOR;
	context.lineWidth = 1.5;
	context.beginPath();
	context.moveTo(cx - 8, cy);
	context.lineTo(cx + 12, cy);
	context.moveTo(cx + 4, cy - 3.5);
	context.lineTo(cx + 14, cy);
	context.lineTo(cx + 4, cy + 3.5);
	context.stroke();

	map.addImage(
		OD_ARROW_ICON_ID,
		context.getImageData(0, 0, canvas.width, canvas.height),
		{ pixelRatio },
	);
}

/** Agrega source y capas para flujos origen-destino. */
export function addODLayers(map: MapLibreMap) {
	if (!map.getSource(OD_SOURCE_ID)) {
		map.addSource(OD_SOURCE_ID, {
			type: "geojson",
			data: EMPTY_FEATURE_COLLECTION,
			lineMetrics: true,
		});
	}

	if (!map.getLayer("od-flow-lines")) {
		map.addLayer({
			id: "od-flow-lines",
			type: "line",
			source: OD_SOURCE_ID,
			paint: {
				"line-color": OD_COLOR,
				"line-width": [
					"interpolate",
					["linear"],
					["zoom"],
					10,
					0.4,
					13,
					1,
					15,
					1.8,
				],
				"line-opacity": 0.7,
			},
		});
	}
}

export function setODData(map: MapLibreMap, data: GeoJSON.FeatureCollection) {
	const source = map.getSource(OD_SOURCE_ID);
	if (source && "setData" in source) {
		(source as GeoJSONSource).setData(data);
	}
}

export function clearODData(map: MapLibreMap) {
	setODData(map, EMPTY_FEATURE_COLLECTION);
}

/**
 * Aplica la visibilidad indicada por el panel lateral, traduciendo cada
 * capa lógica a sus capas físicas en MapLibre.
 */
export function applyLayerVisibility(
	map: MapLibreMap | null,
	visibleLayers: LayerVisibility,
) {
	if (!map) return;
	for (const layer of LAYER_TOGGLES) {
		for (const mapLayerId of LOGICAL_LAYERS[layer.id]) {
			if (map.getLayer(mapLayerId)) {
				map.setLayoutProperty(
					mapLayerId,
					"visibility",
					visibleLayers[layer.id] ? "visible" : "none",
				);
			}
		}
	}
}
