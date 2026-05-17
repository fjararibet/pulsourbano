// biome-ignore-all lint/style/noNonNullAssertion: Float32Array indices are bounded by `n` (the polyline length) on every access in this file; the assertions reflect a true invariant, not a guess.
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
	arrowhead: true,
};

// Cap device pixel ratio: the arrow overlay is decorative, halving pixel work
// on HiDPI displays is invisible at typical viewing distances.
const MAX_DPR = 1.5;
// Target 30fps for the comet animation — still reads as smooth motion, halves
// CPU work versus 60fps.
const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

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
	// Cached interleaved screen-space coords (length = points.length * 2).
	// Rebuilt only when the camera changes or `points` changes.
	flat: Float32Array | null;
	elevated: Float32Array | null;
	// Cumulative pixel length along `elevated` (length = points.length).
	cumLen: Float32Array | null;
	total: number;
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

	// Offscreen layer that pre-renders the static parts (glow + base + arrowhead).
	// Per frame we just blit this and stroke the moving comet on top.
	const staticCanvas = document.createElement("canvas");
	const staticCtx = staticCanvas.getContext("2d");
	if (!staticCtx) {
		canvas.remove();
		throw new Error("ArrowScene: offscreen 2D context unavailable");
	}

	let dpr = 1;
	let projectionsDirty = true;
	let staticDirty = true;

	const resize = () => {
		const rect = container.getBoundingClientRect();
		dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		canvas.width = Math.round(rect.width * dpr);
		canvas.height = Math.round(rect.height * dpr);
		staticCanvas.width = canvas.width;
		staticCanvas.height = canvas.height;
		projectionsDirty = true;
		staticDirty = true;
	};
	resize();
	const ro = new ResizeObserver(resize);
	ro.observe(container);

	const arrows = new Map<number, InternalArrow>();
	let nextId = 1;
	let rafId: number | null = null;
	let disposed = false;
	let lastFrameTime = 0;

	const projectArrow = (arrow: InternalArrow) => {
		const n = arrow.points.length;
		if (n < 2) {
			arrow.total = 0;
			return;
		}
		if (!arrow.flat || arrow.flat.length !== n * 2) {
			arrow.flat = new Float32Array(n * 2);
			arrow.elevated = new Float32Array(n * 2);
			arrow.cumLen = new Float32Array(n);
		}
		const flat = arrow.flat;
		const elevated = arrow.elevated as Float32Array;
		const cumLen = arrow.cumLen as Float32Array;

		for (let i = 0; i < n; i++) {
			const pt = arrow.points[i] as [number, number];
			const proj = map.project([pt[0], pt[1]]);
			flat[i * 2] = proj.x * dpr;
			flat[i * 2 + 1] = proj.y * dpr;
		}

		let totalFlat = 0;
		for (let i = 1; i < n; i++) {
			const dx = flat[i * 2]! - flat[(i - 1) * 2]!;
			const dy = flat[i * 2 + 1]! - flat[(i - 1) * 2 + 1]!;
			totalFlat += Math.sqrt(dx * dx + dy * dy);
		}
		if (totalFlat <= 0) {
			arrow.total = 0;
			return;
		}

		const peak = Math.min(
			totalFlat * arrow.style.archHeight,
			canvas.height * arrow.style.archMax,
		);

		if (peak <= 0) {
			elevated.set(flat);
		} else {
			let acc = 0;
			for (let i = 0; i < n; i++) {
				if (i > 0) {
					const dx = flat[i * 2]! - flat[(i - 1) * 2]!;
					const dy = flat[i * 2 + 1]! - flat[(i - 1) * 2 + 1]!;
					acc += Math.sqrt(dx * dx + dy * dy);
				}
				const t = acc / totalFlat;
				const elev = Math.sin(t * Math.PI) * peak;
				elevated[i * 2] = flat[i * 2]!;
				elevated[i * 2 + 1] = flat[i * 2 + 1]! - elev;
			}
		}

		cumLen[0] = 0;
		let total = 0;
		for (let i = 1; i < n; i++) {
			const dx = elevated[i * 2]! - elevated[(i - 1) * 2]!;
			const dy = elevated[i * 2 + 1]! - elevated[(i - 1) * 2 + 1]!;
			total += Math.sqrt(dx * dx + dy * dy);
			cumLen[i] = total;
		}
		arrow.total = total;
	};

	const reprojectAll = () => {
		for (const arrow of arrows.values()) projectArrow(arrow);
		projectionsDirty = false;
		staticDirty = true;
	};

	const renderStaticLayer = () => {
		staticCtx.clearRect(0, 0, staticCanvas.width, staticCanvas.height);
		staticCtx.lineCap = "round";
		staticCtx.lineJoin = "round";

		for (const arrow of arrows.values()) {
			const { elevated, style } = arrow;
			const n = arrow.points.length;
			if (!elevated || n < 2 || arrow.total <= 0) continue;

			const baseColor = withAlpha(style.color, 0.85);
			const glowStroke = withAlpha(style.color, 0.35);

			if (style.glow) {
				strokeTypedPath(staticCtx, elevated, n);
				staticCtx.strokeStyle = glowStroke;
				staticCtx.lineWidth = (style.thickness + 5.5) * dpr;
				staticCtx.stroke();
			}

			strokeTypedPath(staticCtx, elevated, n);
			staticCtx.strokeStyle = baseColor;
			staticCtx.lineWidth = style.thickness * dpr;
			staticCtx.stroke();

			if (style.arrowhead) {
				const tipX = elevated[(n - 1) * 2]!;
				const tipY = elevated[(n - 1) * 2 + 1]!;
				const fromX = elevated[(n - 2) * 2]!;
				const fromY = elevated[(n - 2) * 2 + 1]!;
				drawArrowHead(
					staticCtx,
					tipX,
					tipY,
					fromX,
					fromY,
					(style.thickness + 1) * dpr,
					style.color,
				);
			}
		}
		staticDirty = false;
	};

	const renderComets = (now: number) => {
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		for (const arrow of arrows.values()) {
			drawCometFromCache(ctx, arrow, now, dpr);
		}
	};

	const renderAll = (now: number) => {
		if (projectionsDirty) reprojectAll();
		if (staticDirty) renderStaticLayer();
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(staticCanvas, 0, 0);
		renderComets(now);
	};

	const tick = (now: number) => {
		rafId = null;
		if (disposed || arrows.size === 0) return;
		if (now - lastFrameTime >= FRAME_INTERVAL_MS) {
			lastFrameTime = now;
			renderAll(now);
		}
		rafId = requestAnimationFrame(tick);
	};

	const ensureLoop = () => {
		if (rafId === null && !disposed && arrows.size > 0) {
			rafId = requestAnimationFrame(tick);
		}
	};

	// Camera moves invalidate the projection cache; the RAF loop picks it up on its next frame.
	const onCameraChange = () => {
		projectionsDirty = true;
	};
	map.on("move", onCameraChange);
	map.on("zoom", onCameraChange);
	map.on("rotate", onCameraChange);
	map.on("pitch", onCameraChange);

	return {
		add(config) {
			const id = nextId++;
			arrows.set(id, {
				points: config.points.map((p) => [p[0], p[1]] as [number, number]),
				style: { ...DEFAULT_STYLE, ...config.style },
				startedAt: performance.now(),
				flat: null,
				elevated: null,
				cumLen: null,
				total: 0,
			});
			projectionsDirty = true;
			staticDirty = true;
			ensureLoop();

			return {
				update(patch) {
					const arrow = arrows.get(id);
					if (!arrow) return;
					if (patch.points) {
						arrow.points = patch.points.map(
							(p) => [p[0], p[1]] as [number, number],
						);
						arrow.flat = null;
						arrow.elevated = null;
						arrow.cumLen = null;
					}
					if (patch.style) {
						arrow.style = { ...arrow.style, ...patch.style };
					}
					projectionsDirty = true;
					staticDirty = true;
				},
				remove() {
					if (!arrows.delete(id)) return;
					staticDirty = true;
					if (arrows.size === 0) {
						ctx.clearRect(0, 0, canvas.width, canvas.height);
						staticCtx.clearRect(0, 0, staticCanvas.width, staticCanvas.height);
					}
				},
			};
		},
		clear() {
			arrows.clear();
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			staticCtx.clearRect(0, 0, staticCanvas.width, staticCanvas.height);
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			ro.disconnect();
			map.off("move", onCameraChange);
			map.off("zoom", onCameraChange);
			map.off("rotate", onCameraChange);
			map.off("pitch", onCameraChange);
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

function strokeTypedPath(
	ctx: CanvasRenderingContext2D,
	coords: Float32Array,
	n: number,
) {
	ctx.beginPath();
	ctx.moveTo(coords[0]!, coords[1]!);
	for (let i = 1; i < n; i++) {
		ctx.lineTo(coords[i * 2]!, coords[i * 2 + 1]!);
	}
}

function drawCometFromCache(
	ctx: CanvasRenderingContext2D,
	arrow: InternalArrow,
	now: number,
	dpr: number,
) {
	const { elevated, cumLen, total, style, startedAt } = arrow;
	const n = arrow.points.length;
	if (!elevated || !cumLen || total <= 0 || n < 2) return;

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

	// Binary search for the segment containing distance `d` along `elevated`.
	const findSegment = (d: number): number => {
		const clamped = Math.max(0, Math.min(total, d));
		let lo = 1;
		let hi = n - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (cumLen[mid]! < clamped) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	};

	const interpolate = (
		d: number,
		i: number,
		out: [number, number],
	): [number, number] => {
		const clamped = Math.max(0, Math.min(total, d));
		const segEnd = cumLen[i]!;
		const segStart = cumLen[i - 1]!;
		const ax = elevated[(i - 1) * 2]!;
		const ay = elevated[(i - 1) * 2 + 1]!;
		const bx = elevated[i * 2]!;
		const by = elevated[i * 2 + 1]!;
		const segLen = segEnd - segStart;
		const local = segLen > 0 ? (clamped - segStart) / segLen : 0;
		out[0] = ax + (bx - ax) * local;
		out[1] = ay + (by - ay) * local;
		return out;
	};

	const tailIdx = findSegment(tailLen);
	const headIdx = findSegment(headLen);
	const tailPt: [number, number] = [0, 0];
	const headPt: [number, number] = [0, 0];
	interpolate(tailLen, tailIdx, tailPt);
	interpolate(headLen, headIdx, headPt);

	ctx.beginPath();
	ctx.moveTo(tailPt[0], tailPt[1]);
	for (let i = tailIdx; i < headIdx; i++) {
		ctx.lineTo(elevated[i * 2]!, elevated[i * 2 + 1]!);
	}
	ctx.lineTo(headPt[0], headPt[1]);
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

	ctx.fillStyle = fillColor;
	ctx.fill();
	ctx.strokeStyle = "rgba(255,255,255,0.9)";
	ctx.lineWidth = 1.2;
	ctx.stroke();

	ctx.restore();
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
