import type { Map as MapLibreMap } from "maplibre-gl";

interface ArrowState {
	points: [number, number][];
	bearing: number;
	headPos: [number, number] | null;
}

let currentState: ArrowState | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let mapInstance: MapLibreMap | null = null;
let startedAt = 0;
let isVisible = false;

export function initRouteArrowOverlay(
	map: MapLibreMap,
	container: HTMLElement,
): () => void {
	if (canvas) return () => {};

	const c = document.createElement("canvas");
	c.style.position = "absolute";
	c.style.top = "0";
	c.style.left = "0";
	c.style.width = "100%";
	c.style.height = "100%";
	c.style.pointerEvents = "none";
	c.style.zIndex = "5";
	container.appendChild(c);

	canvas = c;
	ctx = c.getContext("2d");
	mapInstance = map;

	const resize = () => {
		const rect = container.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		c.width = Math.round(rect.width * dpr);
		c.height = Math.round(rect.height * dpr);
	};
	resize();
	const ro = new ResizeObserver(resize);
	ro.observe(container);

	const onRender = () => {
		if (!isVisible || !ctx || !canvas || !mapInstance || !currentState) {
			return;
		}
		drawArrow(ctx, canvas, currentState, performance.now());
	};
	map.on("render", onRender);

	return () => {
		ro.disconnect();
		map.off("render", onRender);
		c.remove();
		canvas = null;
		ctx = null;
		mapInstance = null;
	};
}

export function showRouteArrowOverlay(
	_map: MapLibreMap,
	geoPoints: [number, number][],
	endBearing: number,
	endPoint: [number, number],
) {
	void _map;
	currentState = {
		points: geoPoints.map((p) => [...p] as [number, number]),
		bearing: endBearing,
		headPos: [...endPoint] as [number, number],
	};
	isVisible = true;
	startedAt = performance.now();
	if (mapInstance) {
		mapInstance.triggerRepaint();
	}
}

export function hideRouteArrowOverlay() {
	isVisible = false;
	currentState = null;
	if (ctx && canvas) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}
	if (mapInstance) {
		mapInstance.triggerRepaint();
	}
}

function drawArrow(
	context: CanvasRenderingContext2D,
	cvs: HTMLCanvasElement,
	state: ArrowState,
	now: number,
) {
	const dpr = window.devicePixelRatio || 1;
	const w = cvs.width;
	const h = cvs.height;
	context.clearRect(0, 0, w, h);

	const screenPoints: [number, number][] = [];
	const pts = state.points;
	for (let i = 0; i < pts.length; i++) {
		const pt = pts[i];
		if (!pt) continue;
		const p = mapInstance?.project([pt[0], pt[1]]);
		if (!p) continue;
		screenPoints.push([p.x * dpr, p.y * dpr]);
	}

	if (screenPoints.length < 2) return;

	const totalLen = computePolylineLength(screenPoints);
	const elevatedPoints: [number, number][] = [];
	let accumulated = 0;
	for (let i = 0; i < screenPoints.length; i++) {
		const cur = screenPoints[i];
		if (!cur) continue;
		if (i > 0) {
			const prev = screenPoints[i - 1];
			if (prev) {
				const dx = cur[0] - prev[0];
				const dy = cur[1] - prev[1];
				accumulated += Math.sqrt(dx * dx + dy * dy);
			}
		}
		const t = totalLen > 0 ? accumulated / totalLen : 0;
		const elevation =
			Math.sin(t * Math.PI) * Math.min(totalLen * 0.18, h * 0.22);
		elevatedPoints.push([cur[0], cur[1] - elevation]);
	}

	if (elevatedPoints.length < 2) return;

	// Shadow on ground (flat, no elevation) — pure shadow blur cast below elevated arrow
	context.save();
	context.lineCap = "round";
	context.lineJoin = "round";

	const first = screenPoints[0];
	if (first) {
		context.beginPath();
		context.moveTo(first[0], first[1]);
		for (let i = 1; i < screenPoints.length; i++) {
			const pt = screenPoints[i];
			if (pt) context.lineTo(pt[0], pt[1]);
		}
		context.shadowColor = "rgba(0,0,0,0.22)";
		context.shadowBlur = 12 * dpr;
		context.shadowOffsetY = 4 * dpr;
		context.strokeStyle = "rgba(0,0,0,0)";
		context.lineWidth = 0;
		context.stroke();
		context.shadowColor = "transparent";
		context.shadowBlur = 0;
		context.shadowOffsetY = 0;
	}

	// Glow
	const ep0 = elevatedPoints[0];
	if (ep0) {
		context.beginPath();
		context.moveTo(ep0[0], ep0[1]);
		for (let i = 1; i < elevatedPoints.length; i++) {
			const pt = elevatedPoints[i];
			if (pt) context.lineTo(pt[0], pt[1]);
		}
		context.shadowColor = "rgba(245, 158, 11, 0.55)";
		context.shadowBlur = 18 * dpr;
		context.strokeStyle = "rgba(245, 158, 11, 0.35)";
		context.lineWidth = 10 * dpr;
		context.stroke();
		context.shadowColor = "transparent";
		context.shadowBlur = 0;
	}

	// Base amber line
	if (ep0) {
		context.beginPath();
		context.moveTo(ep0[0], ep0[1]);
		for (let i = 1; i < elevatedPoints.length; i++) {
			const pt = elevatedPoints[i];
			if (pt) context.lineTo(pt[0], pt[1]);
		}
		context.strokeStyle = "rgba(180, 83, 9, 0.85)";
		context.lineWidth = 4.5 * dpr;
		context.stroke();
	}

	// Animated flowing highlight
	const elapsed = (now - startedAt) / 1000;
	const wavePos = (elapsed % 1.6) / 1.6;
	const headIdx = Math.floor(wavePos * (elevatedPoints.length - 1));
	const tailIdx = Math.max(0, headIdx - 12);

	const tailPt = elevatedPoints[tailIdx];
	if (tailPt) {
		context.beginPath();
		context.moveTo(tailPt[0], tailPt[1]);
		for (let i = tailIdx + 1; i <= headIdx; i++) {
			const pt = elevatedPoints[i];
			if (pt) context.lineTo(pt[0], pt[1]);
		}
		context.strokeStyle = "#ffffff";
		context.lineWidth = 2.8 * dpr;
		context.stroke();
	}

	// Arrowhead at elevated end
	const lastEp = elevatedPoints[elevatedPoints.length - 1];
	const prevEp = elevatedPoints[elevatedPoints.length - 2];
	if (lastEp && prevEp) {
		drawArrowHead(
			context,
			lastEp[0],
			lastEp[1],
			prevEp[0],
			prevEp[1],
			5.5 * dpr,
		);
	}

	context.restore();
}

function computePolylineLength(points: [number, number][]) {
	let len = 0;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		if (a && b) {
			const dx = a[0] - b[0];
			const dy = a[1] - b[1];
			len += Math.sqrt(dx * dx + dy * dy);
		}
	}
	return len;
}

function drawArrowHead(
	context: CanvasRenderingContext2D,
	tipX: number,
	tipY: number,
	fromX: number,
	fromY: number,
	size: number,
) {
	const angle = Math.atan2(tipY - fromY, tipX - fromX);
	context.save();
	context.translate(tipX, tipY);
	context.rotate(angle);

	context.beginPath();
	context.moveTo(0, 0);
	context.lineTo(-size * 1.8, -size * 0.65);
	context.lineTo(-size * 1.1, 0);
	context.lineTo(-size * 1.8, size * 0.65);
	context.closePath();

	context.shadowColor = "rgba(245, 158, 11, 0.6)";
	context.shadowBlur = 10;
	context.fillStyle = "#f59e0b";
	context.fill();
	context.strokeStyle = "rgba(255,255,255,0.9)";
	context.lineWidth = 1.2;
	context.stroke();

	context.restore();
}
