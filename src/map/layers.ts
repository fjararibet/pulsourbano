import type { Map as MapLibreMap } from "maplibre-gl";
import {
	BUS_ARROW_ICON_ID,
	BUS_COLOR,
	COMUNA_COLOR,
	EMPTY_BUS_HOVER_FILTER,
	EMPTY_COMUNA_HOVER_FILTER,
	LAYER_TOGGLES,
	LOGICAL_LAYERS,
} from "./config";
import type { LayerVisibility } from "./types";

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
		id: "comunas-hover-fill",
		type: "fill",
		source: "comunas-rm",
		filter: EMPTY_COMUNA_HOVER_FILTER,
		paint: {
			"fill-color": COMUNA_COLOR,
			"fill-opacity": 0.23,
		},
	});
	map.addLayer({
		id: "comunas-hover-outline",
		type: "line",
		source: "comunas-rm",
		filter: EMPTY_COMUNA_HOVER_FILTER,
		paint: {
			"line-color": COMUNA_COLOR,
			"line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.8, 13, 3],
			"line-opacity": 0.95,
		},
	});
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
