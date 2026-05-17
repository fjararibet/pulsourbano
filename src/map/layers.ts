import type {
	ExpressionSpecification,
	GeoJSONSource,
	Map as MapLibreMap,
} from "maplibre-gl";
import {
	BUS_ARROW_ICON_ID,
	BUS_COLOR,
	COMUNA_COLOR,
	COMUNA_HOVER_LAYER_IDS,
	COMUNA_INTERACTION_LAYER_ID,
	EMPTY_BUS_HOVER_FILTER,
	EMPTY_COMUNA_HOVER_FILTER,
	LAYER_TOGGLES,
	LOGICAL_LAYERS,
} from "./config";
import type { LayerVisibility } from "./types";
import { normalizeComunaName } from "./utils";

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
			"fill-color": [
				"match",
				["get", "Provincia"],
				"Santiago",
				COMUNA_COLOR,
				"Cordillera",
				"#168a76",
				"Chacabuco",
				"#d75235",
				"Maipo",
				"#f2a900",
				"Melipilla",
				"#0f8f98",
				"Talagante",
				"#ba5bd5",
				COMUNA_COLOR,
			],
			"fill-opacity": 0.1,
		},
	});
	map.addLayer({
		id: "comunas-outline",
		type: "line",
		source: "comunas-rm",
		paint: {
			"line-color": COMUNA_COLOR,
			"line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.7, 13, 1.2],
			"line-opacity": 0.5,
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
		id: "comunas-hover-fill",
		type: "fill",
		source: "comunas-rm",
		filter: EMPTY_COMUNA_HOVER_FILTER,
		paint: {
			"fill-color": COMUNA_COLOR,
			"fill-opacity": 0.34,
		},
	});
	map.addLayer({
		id: "comunas-hover-outline",
		type: "line",
		source: "comunas-rm",
		filter: EMPTY_COMUNA_HOVER_FILTER,
		paint: {
			"line-color": COMUNA_COLOR,
			"line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.4, 13, 4.2],
			"line-opacity": 1,
		},
	});
}

/** Mantiene el resaltado de comuna por encima de las demás capas. */
export function bringComunaHoverToFront(map: MapLibreMap) {
	for (const layerId of COMUNA_HOVER_LAYER_IDS) {
		if (map.getLayer(layerId)) map.moveLayer(layerId);
	}
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

const OD_FILL_LAYER_ID = "comunas-od-fill";

/** Agrega la capa de relleno para el modo Origen-Destino (inicialmente oculta). */
export function addODLayers(map: MapLibreMap) {
	if (map.getLayer(OD_FILL_LAYER_ID)) return;
	map.addLayer({
		id: OD_FILL_LAYER_ID,
		type: "fill",
		source: "comunas-rm",
		paint: {
			"fill-color": [
				"interpolate",
				["linear"],
				["get", "od_intensity"],
				0,
				"rgba(111, 91, 213, 0.06)",
				0.25,
				"rgba(111, 91, 213, 0.22)",
				0.5,
				"rgba(111, 91, 213, 0.42)",
				0.75,
				"rgba(111, 91, 213, 0.62)",
				1,
				"rgba(111, 91, 213, 0.82)",
			],
			"fill-opacity": 1,
		},
		layout: {
			visibility: "none",
		},
	});

	// Ensure the comuna hitbox stays on top so clicks still reach it.
	if (map.getLayer(COMUNA_INTERACTION_LAYER_ID)) {
		map.moveLayer(COMUNA_INTERACTION_LAYER_ID);
	}
}

/** Oculta la capa OD y restaura el GeoJSON original (sin od_intensity). */
export function restoreComunaSource(
	map: MapLibreMap,
	originalGeoJSON: GeoJSON.FeatureCollection,
) {
	const source = map.getSource("comunas-rm");
	if (!source || !("setData" in source)) return;
	(source as GeoJSONSource).setData(originalGeoJSON);
	if (map.getLayer(OD_FILL_LAYER_ID)) {
		map.setLayoutProperty(OD_FILL_LAYER_ID, "visibility", "none");
	}
}

/**
 * Pinta las comunas según la intensidad de viajes desde un origen.
 * Actualiza la fuente GeoJSON agregando `od_intensity` a cada feature.
 */
export function setComunaODData(
	map: MapLibreMap,
	odData: Array<{ comuna: string; trips: number; coef?: number }>,
	originalGeoJSON: GeoJSON.FeatureCollection,
) {
	const source = map.getSource("comunas-rm");
	if (!source || !("setData" in source)) return;

	const maxTrips = Math.max(...odData.map((d) => d.trips), 1);
	const tripsMap = new Map<string, number>();
	for (const item of odData) {
		const intensity =
			item.coef !== undefined ? item.coef : item.trips / maxTrips;
		tripsMap.set(normalizeComunaName(item.comuna), intensity);
	}

	const newFeatures = originalGeoJSON.features.map((feature) => {
		const comuna = normalizeComunaName(
			String(feature.properties?.Comuna ?? ""),
		);
		const intensity = tripsMap.get(comuna) ?? 0;
		return {
			...feature,
			properties: {
				...feature.properties,
				od_intensity: intensity,
			},
		};
	});

	(source as GeoJSONSource).setData({
		...originalGeoJSON,
		features: newFeatures,
	});

	if (map.getLayer(OD_FILL_LAYER_ID)) {
		map.setLayoutProperty(OD_FILL_LAYER_ID, "visibility", "visible");
	}
}
