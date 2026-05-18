import type {
	ExpressionSpecification,
	GeoJSONSource,
	Map as MapLibreMap,
} from "maplibre-gl";
import type { CostingMode } from "#/lib/route-store";
import { ROUTE_ARROW_CORE_LAYER_BY_MODE } from "./config";

const HIGHLIGHT_COLOR = "#f8fafc";

export interface ArrowStyle {
	color?: string;
	/** Stroke weight in display units — drives `line-width` per feature. */
	thickness?: number;
	/** Comet animation cycle period in seconds (smaller = faster sweep). */
	highlightSpeed?: number;
}

interface ArrowConfig {
	points: [number, number][];
	/** Identifies which mode's gradient phase applies to this feature. */
	mode: CostingMode;
	style?: ArrowStyle;
}

export interface ArrowHandle {
	update(patch: { points?: [number, number][]; style?: ArrowStyle }): void;
	remove(): void;
}

export interface ArrowMapLibreManager {
	add(config: ArrowConfig): ArrowHandle;
	clear(): void;
	dispose(): void;
}

const COSTING_COLORS: Record<CostingMode, string> = {
	auto: "#b45309",
	bus: "#1d4ed8",
	bicycle: "#047857",
	metro: "#be123c",
};

function hexToRgba(hex: string, alpha: number): string {
	const normalized = hex.replace("#", "");
	const value = /^[0-9a-f]{6}$/i.test(normalized) ? normalized : "f59e0b";
	const red = Number.parseInt(value.slice(0, 2), 16);
	const green = Number.parseInt(value.slice(2, 4), 16);
	const blue = Number.parseInt(value.slice(4, 6), 16);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

type CometStop = readonly [position: number, alpha: number];

const COMET_SHAPE: readonly CometStop[] = [
	[-0.14, 0],
	[-0.05, 0.28],
	[0, 0.78],
	[0.05, 0.28],
	[0.14, 0],
];

const COMET_TAIL_EXTENT = (COMET_SHAPE.at(-1) as CometStop)[0];

function cometAlphaAt(absPos: number, progress: number): number {
	const rel = absPos - progress;
	const first = COMET_SHAPE[0] as CometStop;
	const last = COMET_SHAPE.at(-1) as CometStop;
	if (rel <= first[0] || rel >= last[0]) return 0;
	for (let i = 1; i < COMET_SHAPE.length; i++) {
		const cur = COMET_SHAPE[i] as CometStop;
		if (rel <= cur[0]) {
			const prev = COMET_SHAPE[i - 1] as CometStop;
			const t = (rel - prev[0]) / (cur[0] - prev[0]);
			return prev[1] + (cur[1] - prev[1]) * t;
		}
	}
	return 0;
}

function createCometGradient(
	progress: number,
	color: string,
): ExpressionSpecification {
	// Emit stops only at shape anchors inside (0,1) plus the endpoints —
	// clamping anchors to [0,1] like the old version collapsed duplicates and
	// left the bright head stuck at the tip when progress reached 1.
	const positions = new Set<number>([0, 1]);
	for (const [rel] of COMET_SHAPE) {
		const abs = rel + progress;
		if (abs > 0 && abs < 1) positions.add(abs);
	}

	const sorted = Array.from(positions).sort((a, b) => a - b);
	const expr: unknown[] = ["interpolate", ["linear"], ["line-progress"]];
	for (const pos of sorted) {
		expr.push(pos, hexToRgba(color, cometAlphaAt(pos, progress)));
	}

	return expr as ExpressionSpecification;
}

const DEFAULT_THICKNESS = 3;
const DEFAULT_HIGHLIGHT_SPEED = 1.8;

interface ArrowState {
	points: [number, number][];
	color: string;
	thickness: number;
	highlightSpeed: number;
	mode: CostingMode;
}

export function createArrowMapLibreManager(
	map: MapLibreMap,
): ArrowMapLibreManager {
	const arrows = new Map<number, ArrowState>();
	let nextId = 1;
	let rafId: number | null = null;
	let disposed = false;
	let startedAt = 0;

	const updateData = () => {
		const features: GeoJSON.Feature[] = [];
		for (const [, arrow] of arrows) {
			const coords = arrow.points;
			if (coords.length < 2) continue;

			features.push({
				type: "Feature",
				geometry: {
					type: "LineString",
					coordinates: coords,
				},
				properties: {
					color: arrow.color,
					mode: arrow.mode,
					thickness: arrow.thickness,
				},
			});
		}

		const source = map.getSource("route-arrow");
		if (source && "setData" in source) {
			(source as GeoJSONSource).setData({
				type: "FeatureCollection",
				features,
			});
		}
	};

	const buildModeGradient = (elapsedSeconds: number, speed: number) => {
		const cycle = Math.max(0.001, speed);
		const t = (elapsedSeconds % cycle) / cycle;
		// Overshoot [0,1] by the tail extent so the head fades off the end
		// instead of stopping there.
		const waveProgress = t * (1 + 2 * COMET_TAIL_EXTENT) - COMET_TAIL_EXTENT;
		return createCometGradient(waveProgress, HIGHLIGHT_COLOR);
	};

	const animate = (time: number) => {
		if (disposed || arrows.size === 0) return;
		if (startedAt === 0) startedAt = time;
		const elapsedSeconds = (time - startedAt) / 1000;

		// Each transport mode has its own core layer, so we set its gradient
		// independently based on its own cycle period.
		const speedByMode = new Map<CostingMode, number>();
		for (const arrow of arrows.values()) {
			if (!speedByMode.has(arrow.mode)) {
				speedByMode.set(arrow.mode, arrow.highlightSpeed);
			}
		}

		for (const [mode, speed] of speedByMode) {
			const layerId = ROUTE_ARROW_CORE_LAYER_BY_MODE[mode];
			setPaintPropertyIfLayerExists(
				map,
				layerId,
				"line-gradient",
				buildModeGradient(elapsedSeconds, speed),
			);
		}

		rafId = requestAnimationFrame(animate);
	};

	const ensureLoop = () => {
		if (rafId === null && !disposed && arrows.size > 0) {
			rafId = requestAnimationFrame(animate);
		}
	};

	return {
		add(config) {
			const id = nextId++;
			const color = config.style?.color ?? COSTING_COLORS[config.mode];
			arrows.set(id, {
				points: config.points.map((p) => [p[0], p[1]] as [number, number]),
				color,
				thickness: config.style?.thickness ?? DEFAULT_THICKNESS,
				highlightSpeed: config.style?.highlightSpeed ?? DEFAULT_HIGHLIGHT_SPEED,
				mode: config.mode,
			});
			updateData();
			ensureLoop();

			return {
				update(patch) {
					const arrow = arrows.get(id);
					if (!arrow) return;
					if (patch.points) {
						arrow.points = patch.points.map(
							(p) => [p[0], p[1]] as [number, number],
						);
					}
					if (patch.style?.color) arrow.color = patch.style.color;
					if (patch.style?.thickness !== undefined)
						arrow.thickness = patch.style.thickness;
					if (patch.style?.highlightSpeed !== undefined)
						arrow.highlightSpeed = patch.style.highlightSpeed;
					updateData();
				},
				remove() {
					arrows.delete(id);
					updateData();
					if (arrows.size === 0 && rafId !== null) {
						cancelAnimationFrame(rafId);
						rafId = null;
					}
				},
			};
		},
		clear() {
			arrows.clear();
			updateData();
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			arrows.clear();
		},
	};
}

function setPaintPropertyIfLayerExists(
	map: MapLibreMap,
	layerId: string,
	property: string,
	value: unknown,
) {
	if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, value);
}
