import type { FilterSpecification } from "maplibre-gl";
import type { LayerVisibility } from "./types";

/** Centro y zoom inicial del mapa (Plaza de Armas / Stgo Centro). */
export const SANTIAGO_CENTER: [number, number] = [-70.6483, -33.4569];
export const INITIAL_ZOOM = 11;

/** Zoom al hacer click en una comuna. */
export const COMUNA_ZOOM = 13;

/** Cámara de detalle: vista lateral al entrar en una comuna. */
export const MAP_DETAIL_PITCH = 68;
export const MAP_DETAIL_BEARING = -22;

/** Color para hover de comuna. */
export const COMUNA_HOVER_COLOR = "#6f5bd5";

/** Color para comuna seleccionada (pin active). */
export const COMUNA_SELECTED_COLOR = "#1e3a8a";

/** Color para comuna origen. */
export const ORIGEN_COLOR = "#10a56f";

/** Color para comuna destino. */
export const DESTINO_COLOR = "#3b82f6";

/** Color base de la red de buses RED. */
export const BUS_COLOR = "#d75235";

/** Identificador del ícono de flecha que se dibuja sobre los recorridos. */
export const BUS_ARROW_ICON_ID = "bus-route-arrow";

/** Color de la flecha de ruta origen-destino. */
export const OD_COLOR = "#e67e22";

/** Identificador del ícono de flecha para flujos OD. */
export const OD_ARROW_ICON_ID = "od-flow-arrow";

/** ID de la fuente GeoJSON de flujos OD. */
export const OD_SOURCE_ID = "od-flows";

/** Color base de la capa de comunas RM. */
export const COMUNA_COLOR = "#6f5bd5";

/** Color de la flecha de ruta origen-destino. */
export const ROUTE_ARROW_COLOR = "#f59e0b";

/** ID de la fuente GeoJSON de la flecha de ruta. */
export const ROUTE_ARROW_SOURCE_ID = "route-arrow";

/**
 * Capas `route-arrow-core` divididas por modo. `line-gradient` solo admite
 * expresiones sobre `line-progress` (sin data-driven styling), así que para
 * que cada modo pulse a su propio ritmo cada uno necesita su propia capa
 * con su filtro por `mode`.
 */
export const ROUTE_ARROW_CORE_LAYER_BY_MODE = {
	auto: "route-arrow-core-auto",
	bus: "route-arrow-core-bus",
	bicycle: "route-arrow-core-bicycle",
	metro: "route-arrow-core-metro",
} as const;

export const ROUTE_ARROW_CORE_LAYER_IDS = Object.values(
	ROUTE_ARROW_CORE_LAYER_BY_MODE,
);

/** Capas visuales de la flecha de ruta. */
export const ROUTE_ARROW_LAYER_IDS = [
	"route-arrow-shadow",
	"route-arrow-glow",
	"route-arrow-base",
	...ROUTE_ARROW_CORE_LAYER_IDS,
] as const;

/** Capa invisible que mantiene el hover de comunas siempre disponible. */
export const COMUNA_INTERACTION_LAYER_ID = "comunas-hitbox";

/** Capas visuales de la comuna seleccionada (pin active). */
export const COMUNA_SELECTED_LAYER_IDS = [
	"comunas-selected-fill",
	"comunas-selected-outline",
] as const;

/** Capas visuales de la comuna origen. */
export const COMUNA_ORIGEN_LAYER_IDS = [
	"comunas-origen-fill",
	"comunas-origen-outline",
] as const;

/** Capas visuales de la comuna destino. */
export const COMUNA_DESTINO_LAYER_IDS = [
	"comunas-destino-fill",
	"comunas-destino-outline",
] as const;

/** Todas las capas físicas del grupo comunas, incluyendo interacción y selección. */
export const COMUNA_ALL_LAYER_IDS = [
	"comunas-fill",
	"comunas-outline",
	COMUNA_INTERACTION_LAYER_ID,
	...COMUNA_SELECTED_LAYER_IDS,
	...COMUNA_ORIGEN_LAYER_IDS,
	...COMUNA_DESTINO_LAYER_IDS,
	...ROUTE_ARROW_LAYER_IDS,
] as const;

/** Capas comunales base que se mantienen visibles como referencia espacial. */
export const COMUNA_BASE_LAYER_IDS = [
	"comunas-fill",
	"comunas-outline",
] as const;

/** Todas las capas físicas del grupo metro. */
export const METRO_ALL_LAYER_IDS = [
	"metro-line-halo",
	"metro-lines",
	"metro-stations",
] as const;

/**
 * Filtro neutro que oculta la capa "hover" de buses cuando no hay
 * ningún recorrido seleccionado bajo el cursor.
 */
export const EMPTY_BUS_HOVER_FILTER: FilterSpecification = [
	"==",
	["get", "route_key"],
	"",
];

/** Filtro neutro que oculta el resaltado de comuna. */
export const EMPTY_COMUNA_HOVER_FILTER: FilterSpecification = [
	"==",
	["get", "cod_comuna"],
	-1,
];

/** Filtro neutro que oculta el resaltado por nombre de comuna. */
export const EMPTY_COMUNA_NAME_FILTER: FilterSpecification = [
	"==",
	["get", "Comuna"],
	"",
];

/** Filtro neutro que oculta el resaltado comunal de ruido. */
export const EMPTY_NOISE_COMUNA_FILTER: FilterSpecification = [
	"==",
	["get", "COMUNA"],
	"",
];

/**
 * Capas que el usuario puede prender/apagar desde el panel lateral.
 * El orden define el orden en la UI.
 */
export const LAYER_TOGGLES = [
	{
		id: "comunas",
		label: "Comunas RM",
		description: "Límites comunales",
		color: COMUNA_COLOR,
	},
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
	comunas: false,
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
/** Color representativo de la capa de ruido (botón, leyenda, accent). */
export const NOISE_COLOR = "#ef4444";

/** Fuente de comunas completas enriquecidas con promedio de ruido. */
export const NOISE_COMUNA_SOURCE_ID = "noise-comunas";

/** Capa invisible para hover por comuna completa en la capa ruido. */
export const NOISE_COMUNA_INTERACTION_LAYER_ID = "noise-comunas-hitbox";

/** Capas de zonas de ruido que se refuerzan al seleccionar una comuna. */
export const NOISE_SELECTED_ZONE_LAYER_IDS = ["noise-selected-fill"] as const;

/** Capas visibles del resaltado comunal de ruido. */
export const NOISE_COMUNA_HOVER_LAYER_IDS = [
	"noise-comunas-hover-fill",
	"noise-comunas-hover-outline",
] as const;

/** Capas visibles de la comuna seleccionada con ruido activo. */
export const NOISE_COMUNA_SELECTED_LAYER_IDS = [
	"noise-comunas-selected-fill",
	"noise-comunas-selected-outline",
] as const;

/** Capas visibles cuando ruido funciona como overlay de comunas seleccionadas. */
export const NOISE_OVERLAY_LAYER_IDS = [
	"noise-fill",
	"noise-outline",
	...NOISE_SELECTED_ZONE_LAYER_IDS,
	...NOISE_COMUNA_SELECTED_LAYER_IDS,
] as const;

/** Todas las capas físicas del grupo ruido. */
export const NOISE_ALL_LAYER_IDS = [
	...NOISE_OVERLAY_LAYER_IDS,
	...NOISE_COMUNA_HOVER_LAYER_IDS,
	NOISE_COMUNA_INTERACTION_LAYER_ID,
] as const;

export const LOGICAL_LAYERS = {
	comunas: ["comunas-fill", "comunas-outline"],
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
				"https://a.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}{ratio}.png",
				"https://b.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}{ratio}.png",
				"https://c.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}{ratio}.png",
				"https://d.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}{ratio}.png",
			],
			tileSize: 256,
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
		},
		"terrain-dem": {
			type: "raster-dem" as const,
			tiles: [
				"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
			],
			tileSize: 256,
			maxzoom: 15,
			encoding: "terrarium" as const,
			attribution:
				'© <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>',
		},
		"hillshade-dem": {
			type: "raster-dem" as const,
			tiles: [
				"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
			],
			tileSize: 256,
			maxzoom: 15,
			encoding: "terrarium" as const,
			attribution:
				'© <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>',
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
		{
			id: "terrain-hillshade",
			type: "hillshade" as const,
			source: "hillshade-dem",
			paint: {
				"hillshade-exaggeration": 0.3,
				"hillshade-shadow-color": "rgba(0,0,0,0.2)",
				"hillshade-highlight-color": "rgba(255,255,255,0.25)",
				"hillshade-accent-color": "rgba(0,0,0,0.06)",
				"hillshade-illumination-direction": 315,
			},
		},
	],
	terrain: {
		source: "terrain-dem",
		exaggeration: 1.4,
	},
};
