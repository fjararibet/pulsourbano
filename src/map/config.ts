import type { LayerVisibility } from "./types";

/** Centro y zoom inicial del mapa (Plaza de Armas / Stgo Centro). */
export const SANTIAGO_CENTER: [number, number] = [-70.6483, -33.4569];
export const INITIAL_ZOOM = 11;

/** Color base de la red de buses RED. */
export const BUS_COLOR = "#d75235";

/** Identificador del ícono de flecha que se dibuja sobre los recorridos. */
export const BUS_ARROW_ICON_ID = "bus-route-arrow";

/**
 * Filtro neutro que oculta la capa "hover" de buses cuando no hay
 * ningún recorrido seleccionado bajo el cursor.
 */
export const EMPTY_BUS_HOVER_FILTER = ["==", ["get", "route_key"], ""] as const;

/**
 * Capas que el usuario puede prender/apagar desde el panel lateral.
 * El orden define el orden en la UI.
 */
export const LAYER_TOGGLES = [
	{
		id: "metro",
		label: "Metro",
		description: "Líneas por color oficial",
		color: "#0f8f98",
	},
	{
		id: "stations",
		label: "Estaciones",
		description: "Nombre al pasar el cursor",
		color: "#102f37",
	},
	{
		id: "buses",
		label: "Micros RED",
		description: "Recorridos en baja opacidad",
		color: BUS_COLOR,
	},
	{
		id: "busStops",
		label: "Paraderos RED",
		description: "Aparecen al acercar zoom",
		color: "#f2a900",
	},
	{
		id: "cycleways",
		label: "Ciclovías",
		description: "Red ciclista segmentada",
		color: "#10a56f",
	},
] as const;

/** ID de cada capa lógica del UI (derivado de `LAYER_TOGGLES`). */
export type LayerId = (typeof LAYER_TOGGLES)[number]["id"];

/** Estado inicial de qué capas vienen prendidas. */
export const DEFAULT_VISIBLE_LAYERS: LayerVisibility = {
	metro: true,
	stations: true,
	buses: true,
	busStops: false,
	cycleways: true,
};

/**
 * Mapeo de "capa lógica" (la del UI) a los IDs reales de capa en MapLibre.
 * Una capa lógica puede empujar varias capas físicas (halo + línea, etc.).
 */
export const LOGICAL_LAYERS = {
	metro: ["metro-line-halo", "metro-lines"],
	stations: ["metro-stations"],
	buses: [
		"bus-routes",
		"bus-route-arrows",
		"bus-hover-lines",
		"bus-hover-arrows",
	],
	busStops: ["bus-stops"],
	cycleways: ["cycleway-lines"],
} as const satisfies Record<LayerId, string[]>;

/**
 * Style base de MapLibre. Carto Voyager usa `{ratio}` (no `{r}`) para tiles retina.
 */
export const BASE_STYLE = {
	version: 8 as const,
	sources: {
		"carto-tiles": {
			type: "raster" as const,
			tiles: [
				"https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
				"https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
				"https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
				"https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
			],
			tileSize: 256,
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
		},
	},
	layers: [
		{
			id: "map-background",
			type: "background" as const,
			paint: { "background-color": "#edf4e8" },
		},
		{
			id: "carto-tiles",
			type: "raster" as const,
			source: "carto-tiles",
			paint: {
				"raster-opacity": 0.9,
				"raster-saturation": -0.12,
			},
		},
	],
} as const;
