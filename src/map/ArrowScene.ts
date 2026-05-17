import type { Map as MapLibreMap } from "maplibre-gl";

export interface ArrowStyle {
	/** Primary color of the arrow (hex `#rrggbb`). Used for the line, glow, and arrowhead. */
	color?: string;
	/** Color of the moving comet highlight. */
	highlightColor?: string;
	/** Base line width in CSS pixels. */
	thickness?: number;
	/** Arch peak as a fraction of polyline screen length. */
	archHeight?: number;
	/** Arch peak cap as a fraction of canvas height (prevents huge arches on long routes). */
	archMax?: number;
	/** Seconds per full comet cycle. Smaller = faster. */
	highlightSpeed?: number;
	/** Comet highlight line width in CSS pixels. */
	highlightWidth?: number;
	/** Comet tail length as a fraction of the arrow. */
	tailFraction?: number;
	glow?: boolean;
	shadow?: boolean;
	arrowhead?: boolean;
}

type ResolvedStyle = Required<ArrowStyle>;

const DEFAULT_STYLE: ResolvedStyle = {
	color: "#f59e0b",
	highlightColor: "#ffffff",
	thickness: 4.5,
	archHeight: 0.18,
	archMax: 0.22,
	highlightSpeed: 1.8,
	highlightWidth: 2.8,
	tailFraction: 0.18,
	glow: true,
	shadow: true,
	arrowhead: true,
};

export interface ArrowConfig {
	/** Polyline in [lng, lat] pairs. */
	points: [number, number][];
	style?: ArrowStyle;
}

export interface ArrowHandle {
	update(patch: { points?: [number, number][]; style?: ArrowStyle }): void;
	remove(): void;
}

export interface ArrowScene {
	add(config: ArrowConfig): ArrowHandle;
	clear(): void;
	dispose(): void;
}

interface InternalArrow {
	points: [number, number][];
	style: ResolvedStyle;
	startedAt: number;
}

export function createArrowScene(
	map: MapLibreMap,
	container: HTMLElement,
): ArrowScene {
	const canvas = document.createElement("canvas");
	canvas.style.position = "absolute";
	canvas.style.top = "0";
	canvas.style.left = "0";
	canvas.style.width = "100%";
	canvas.style.height = "100%";
	canvas.style.pointerEvents = "none";
	canvas.style.zIndex = "5";
	container.appendChild(canvas);

	const ctx = canvas.getContext("2d");
	if (!ctx) {
		canvas.remove();
		throw new Error("ArrowScene: 2D canvas context unavailable");
	}

	const resize = () => {
		const rect = container.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(rect.width * dpr);
		canvas.height = Math.round(rect.height * dpr);
	};
	resize();
	const ro = new ResizeObserver(resize);
	ro.observe(container);

	const arrows = new Map<number, InternalArrow>();
	let nextId = 1;
	let rafId: number | null = null;
	let disposed = false;

	const renderAll = (now: number) => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (const arrow of arrows.values()) {
			drawArrow(ctx, canvas, map, arrow, now);
		}
	};

	const tick = () => {
		rafId = null;
		if (disposed || arrows.size === 0) return;
		renderAll(performance.now());
		rafId = requestAnimationFrame(tick);
	};

	const ensureLoop = () => {
		if (rafId === null && !disposed && arrows.size > 0) {
			rafId = requestAnimationFrame(tick);
		}
	};

	const onMapRender = () => {
		if (disposed || arrows.size === 0) return;
		renderAll(performance.now());
	};
	map.on("render", onMapRender);

	return {
		add(config) {
			const id = nextId++;
			arrows.set(id, {
				points: config.points.map((p) => [p[0], p[1]] as [number, number]),
				style: { ...DEFAULT_STYLE, ...config.style },
				startedAt: performance.now(),
			});
			ensureLoop();
			map.triggerRepaint();

			return {
				update(patch) {
					const arrow = arrows.get(id);
					if (!arrow) return;
					if (patch.points) {
						arrow.points = patch.points.map(
							(p) => [p[0], p[1]] as [number, number],
						);
					}
					if (patch.style) {
						arrow.style = { ...arrow.style, ...patch.style };
					}
					map.triggerRepaint();
				},
				remove() {
					if (!arrows.delete(id)) return;
					if (arrows.size === 0) {
						ctx.clearRect(0, 0, canvas.width, canvas.height);
					}
					map.triggerRepaint();
				},
			};
		},
		clear() {
			arrows.clear();
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			map.triggerRepaint();
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			ro.disconnect();
			map.off("render", onMapRender);
			canvas.remove();
		},
	};
}

export interface ArcOptions {
	/**
	 * Signed magnitude of the perpendicular swing as a fraction of the
	 * start→end distance. Positive bends one side of the chord, negative
	 * bends the other. Vary this between arrows that share endpoints to
	 * give them visually distinct routes.
	 */
	lateralOffset?: number;
	/** Number of polyline segments. */
	segments?: number;
}

/** Quadratic Bézier arc between two lng/lat points, suitable for `ArrowScene.add`. */
export function arcLineString(
	start: [number, number],
	end: [number, number],
	options: ArcOptions = {},
): [number, number][] {
	const { lateralOffset = 0.55, segments = 80 } = options;

	const midLng = (start[0] + end[0]) / 2;
	const midLat = (start[1] + end[1]) / 2;
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const dist = Math.sqrt(dx * dx + dy * dy) || 1;
	const perpLng = (-dy / dist) * dist * lateralOffset;
	const perpLat = (dx / dist) * dist * lateralOffset;
	const cLng = midLng + perpLng;
	const cLat = midLat + perpLat;

	const points: [number, number][] = [];
	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const u = 1 - t;
		const lng = u * u * start[0] + 2 * u * t * cLng + t * t * end[0];
		const lat = u * u * start[1] + 2 * u * t * cLat + t * t * end[1];
		points.push([lng, lat]);
	}
	return points;
}

function drawArrow(
	ctx: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	map: MapLibreMap,
	arrow: InternalArrow,
	now: number,
) {
	const { points, style, startedAt } = arrow;
	if (points.length < 2) return;

	const dpr = window.devicePixelRatio || 1;
	const h = canvas.height;

	const screenPoints: [number, number][] = [];
	for (const [lng, lat] of points) {
		const p = map.project([lng, lat]);
		screenPoints.push([p.x * dpr, p.y * dpr]);
	}
	if (screenPoints.length < 2) return;

	const totalLen = polylineLength(screenPoints);
	if (totalLen <= 0) return;

	const peak = Math.min(totalLen * style.archHeight, h * style.archMax);
	const elevated: [number, number][] = [];
	let acc = 0;
	let prev: [number, number] | null = null;
	for (const cur of screenPoints) {
		if (prev) {
			const sdx = cur[0] - prev[0];
			const sdy = cur[1] - prev[1];
			acc += Math.sqrt(sdx * sdx + sdy * sdy);
		}
		const t = acc / totalLen;
		const elev = Math.sin(t * Math.PI) * peak;
		elevated.push([cur[0], cur[1] - elev]);
		prev = cur;
	}

	const baseColor = withAlpha(style.color, 0.85);
	const glowStroke = withAlpha(style.color, 0.35);
	const glowShadow = withAlpha(style.color, 0.55);
	const arrowheadGlow = withAlpha(style.color, 0.6);

	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";

	if (style.shadow) {
		strokePolyline(ctx, screenPoints);
		ctx.shadowColor = "rgba(0,0,0,0.22)";
		ctx.shadowBlur = 16 * dpr;
		ctx.shadowOffsetY = 6 * dpr;
		ctx.strokeStyle = "rgba(0,0,0,0.12)";
		ctx.lineWidth = (style.thickness + 3.5) * dpr;
		ctx.stroke();
		ctx.shadowColor = "transparent";
		ctx.shadowBlur = 0;
		ctx.shadowOffsetY = 0;
	}

	if (style.glow) {
		strokePolyline(ctx, elevated);
		ctx.shadowColor = glowShadow;
		ctx.shadowBlur = 18 * dpr;
		ctx.strokeStyle = glowStroke;
		ctx.lineWidth = (style.thickness + 5.5) * dpr;
		ctx.stroke();
		ctx.shadowColor = "transparent";
		ctx.shadowBlur = 0;
	}

	strokePolyline(ctx, elevated);
	ctx.strokeStyle = baseColor;
	ctx.lineWidth = style.thickness * dpr;
	ctx.stroke();

	drawHighlight(ctx, elevated, style, startedAt, now, dpr);

	if (style.arrowhead) {
		const tip = elevated[elevated.length - 1];
		const before = elevated[elevated.length - 2];
		if (tip && before) {
			drawArrowHead(
				ctx,
				tip[0],
				tip[1],
				before[0],
				before[1],
				(style.thickness + 1) * dpr,
				style.color,
				arrowheadGlow,
			);
		}
	}

	ctx.restore();
}

function strokePolyline(
	ctx: CanvasRenderingContext2D,
	points: [number, number][],
) {
	ctx.beginPath();
	let started = false;
	for (const pt of points) {
		if (!started) {
			ctx.moveTo(pt[0], pt[1]);
			started = true;
		} else {
			ctx.lineTo(pt[0], pt[1]);
		}
	}
}

function drawHighlight(
	ctx: CanvasRenderingContext2D,
	elevated: [number, number][],
	style: ResolvedStyle,
	startedAt: number,
	now: number,
	dpr: number,
) {
	const cumLen: number[] = [0];
	let running = 0;
	let prev: [number, number] | null = null;
	for (const cur of elevated) {
		if (prev) {
			const dx = cur[0] - prev[0];
			const dy = cur[1] - prev[1];
			running += Math.sqrt(dx * dx + dy * dy);
			cumLen.push(running);
		}
		prev = cur;
	}
	const total = running;
	if (total <= 0) return;

	const elapsed = (now - startedAt) / 1000;
	const cycle = Math.max(0.001, style.highlightSpeed);
	const phase = (elapsed % cycle) / cycle;
	const tailFrac = style.tailFraction;
	// Sweep past the tip so the tail clears before a new comet enters — no pause.
	const headFrac = phase * (1 + tailFrac);
	const rawHead = headFrac * total;
	const rawTail = rawHead - tailFrac * total;
	const headLen = Math.min(total, rawHead);
	const tailLen = Math.max(0, rawTail);

	const pointAt = (d: number): [number, number] | null => {
		const clamped = Math.max(0, Math.min(total, d));
		for (let i = 1; i < cumLen.length; i++) {
			const segEnd = cumLen[i];
			const segStart = cumLen[i - 1];
			const a = elevated[i - 1];
			const b = elevated[i];
			if (segEnd === undefined || segStart === undefined || !a || !b) continue;
			if (segEnd >= clamped) {
				const segLen = segEnd - segStart;
				const local = segLen > 0 ? (clamped - segStart) / segLen : 0;
				return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local];
			}
		}
		return elevated[elevated.length - 1] ?? null;
	};

	const tailPoint = pointAt(tailLen);
	const headPoint = pointAt(headLen);
	if (!tailPoint || !headPoint) return;

	ctx.beginPath();
	ctx.moveTo(tailPoint[0], tailPoint[1]);
	for (let i = 0; i < cumLen.length; i++) {
		const cl = cumLen[i];
		const pt = elevated[i];
		if (cl !== undefined && pt && cl > tailLen && cl < headLen) {
			ctx.lineTo(pt[0], pt[1]);
		}
	}
	ctx.lineTo(headPoint[0], headPoint[1]);
	ctx.strokeStyle = style.highlightColor;
	ctx.lineWidth = style.highlightWidth * dpr;
	ctx.stroke();
}

function drawArrowHead(
	ctx: CanvasRenderingContext2D,
	tipX: number,
	tipY: number,
	fromX: number,
	fromY: number,
	size: number,
	fillColor: string,
	glowColor: string,
) {
	const angle = Math.atan2(tipY - fromY, tipX - fromX);
	ctx.save();
	ctx.translate(tipX, tipY);
	ctx.rotate(angle);

	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(-size * 1.8, -size * 0.65);
	ctx.lineTo(-size * 1.1, 0);
	ctx.lineTo(-size * 1.8, size * 0.65);
	ctx.closePath();

	ctx.shadowColor = glowColor;
	ctx.shadowBlur = 10;
	ctx.fillStyle = fillColor;
	ctx.fill();
	ctx.strokeStyle = "rgba(255,255,255,0.9)";
	ctx.lineWidth = 1.2;
	ctx.stroke();

	ctx.restore();
}

function polylineLength(points: [number, number][]): number {
	let len = 0;
	let prev: [number, number] | null = null;
	for (const cur of points) {
		if (prev) {
			const dx = cur[0] - prev[0];
			const dy = cur[1] - prev[1];
			len += Math.sqrt(dx * dx + dy * dy);
		}
		prev = cur;
	}
	return len;
}

function withAlpha(color: string, alpha: number): string {
	if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
		const hex =
			color.length === 4
				? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
				: color;
		const r = Number.parseInt(hex.slice(1, 3), 16);
		const g = Number.parseInt(hex.slice(3, 5), 16);
		const b = Number.parseInt(hex.slice(5, 7), 16);
		return `rgba(${r},${g},${b},${alpha})`;
	}
	return color;
}
