import type {
	ExpressionSpecification,
	GeoJSONSource,
	Map as MapLibreMap,
} from "maplibre-gl";
import type { CostingMode } from "#/lib/route-store";
import { ROUTE_ARROW_COLOR } from "./config";

export interface ArrowStyle {
	color?: string;
	highlightColor?: string;
	thickness?: number;
	archHeight?: number;
	archMax?: number;
	highlightSpeed?: number;
	highlightWidth?: number;
	tailFraction?: number;
	glow?: boolean;
	arrowhead?: boolean;
}

interface ArrowConfig {
	points: [number, number][];
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
	auto: "#f59e0b",
	bus: "#3b82f6",
	bicycle: "#10b981",
	pedestrian: "#8b5cf6",
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
	[-0.05, 0.35],
	[0, 0.95],
	[0.05, 0.35],
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

export function createArrowMapLibreManager(
	map: MapLibreMap,
	_costing: CostingMode,
): ArrowMapLibreManager {
	const arrows = new Map<
		number,
		{ points: [number, number][]; color: string }
	>();
	let nextId = 1;
	let rafId: number | null = null;
	let disposed = false;
	let startedAt = 0;
	const highlightSpeed = 1.8;

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
				properties: { color: arrow.color },
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

	const animate = (time: number) => {
		if (disposed || arrows.size === 0) return;
		if (startedAt === 0) startedAt = time;

		const elapsedSeconds = (time - startedAt) / 1000;
		const cycle = Math.max(0.001, highlightSpeed);
		const t = (elapsedSeconds % cycle) / cycle;
		// Overshoot [0,1] by the tail extent so the head fades off the end
		// instead of stopping there.
		const waveProgress = t * (1 + 2 * COMET_TAIL_EXTENT) - COMET_TAIL_EXTENT;

		setPaintPropertyIfLayerExists(
			map,
			"route-arrow-core",
			"line-gradient",
			createCometGradient(waveProgress, ROUTE_ARROW_COLOR),
		);

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
			const color = config.style?.color ?? COSTING_COLORS[_costing];
			arrows.set(id, {
				points: config.points.map((p) => [p[0], p[1]] as [number, number]),
				color,
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
					if (patch.style?.color) {
						arrow.color = patch.style.color;
					}
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
