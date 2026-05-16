function isYellowOrOrange(hex: string): boolean {
	// Parse #RRGGBB or #RGB
	let r: number, g: number, b: number;
	if (hex.length === 4) {
		r = parseInt(hex[1] + hex[1], 16);
		g = parseInt(hex[2] + hex[2], 16);
		b = parseInt(hex[3] + hex[3], 16);
	} else if (hex.length === 7) {
		r = parseInt(hex.slice(1, 3), 16);
		g = parseInt(hex.slice(3, 5), 16);
		b = parseInt(hex.slice(5, 7), 16);
	} else {
		return false;
	}
	// Yellow / orange / gold: high red, high green, low blue
	return r > 200 && g > 150 && b < 120;
}

function hexToGray(hex: string): string {
	// Convert yellowish to a neutral gray based on luminance
	let r: number, g: number, b: number;
	if (hex.length === 4) {
		r = parseInt(hex[1] + hex[1], 16);
		g = parseInt(hex[2] + hex[2], 16);
		b = parseInt(hex[3] + hex[3], 16);
	} else {
		r = parseInt(hex.slice(1, 3), 16);
		g = parseInt(hex.slice(3, 5), 16);
		b = parseInt(hex.slice(5, 7), 16);
	}
	const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
	const c = lum.toString(16).padStart(2, "0");
	return `#${c}${c}${c}`;
}

function killYellow(value: unknown): unknown {
	if (typeof value === "string") {
		if (value.startsWith("#") && isYellowOrOrange(value)) {
			return hexToGray(value);
		}
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(killYellow);
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			out[k] = killYellow(v);
		}
		return out;
	}
	return value;
}

function isRoadLayer(id: string): boolean {
	const roadKeywords = [
		"motorway",
		"trunk",
		"primary",
		"secondary",
		"tertiary",
		"residential",
		"street",
		"service",
		"unclassified",
		"living_street",
		"pedestrian",
		"path",
		"track",
		"road",
		"raceway",
		"bridge",
		"tunnel",
		"aeroway",
	];
	return roadKeywords.some((kw) => id.includes(kw));
}

function isBigRoad(id: string): boolean {
	return (
		id.includes("motorway") || id.includes("trunk") || id.includes("primary")
	);
}

function isShieldLayer(id: string): boolean {
	return id.includes("shield") || id.includes("symbol");
}

export async function fetchCustomStyle(): Promise<object> {
	const res = await fetch(
		"https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
	);
	const style = (await res.json()) as any;

	const patchedLayers = style.layers
		.filter((layer: any) => {
			if (layer.type === "fill-extrusion") return false;
			if (layer.id && layer.id.includes("3d")) return false;
			return true;
		})
		.map((layer: any) => {
			const id: string = layer.id || "";

			// ── Global yellow/orange killer ──
			let patched = killYellow(layer) as any;

			if (!patched.paint) return patched;
			const paint = { ...patched.paint };

			// ── Water ──
			if (id.startsWith("waterway")) {
				if (paint["line-color"] !== undefined) {
					paint["line-color"] = "#B7EEF7";
				}
				return { ...patched, paint };
			}
			if (id.startsWith("water")) {
				if (paint["fill-color"] !== undefined) {
					paint["fill-color"] = "#90D9ED";
				}
				return { ...patched, paint };
			}

			// ── Parks / Green ──
			if (id.includes("park") || id.includes("garden")) {
				if (paint["fill-color"] !== undefined) {
					paint["fill-color"] = "#D3F7E1";
				}
				return { ...patched, paint };
			}
			if (id.includes("wood") || id.includes("forest")) {
				if (paint["fill-color"] !== undefined) {
					paint["fill-color"] = "#C2F0D4";
				}
				return { ...patched, paint };
			}
			if (id.includes("grass") || id.includes("meadow")) {
				if (paint["fill-color"] !== undefined) {
					paint["fill-color"] = "#E6F5EB";
				}
				return { ...patched, paint };
			}

			// ── Buildings (flat, no shadow) ──
			if (id.includes("building")) {
				if (paint["fill-color"] !== undefined) {
					const tints = ["#F7F4F4", "#F6F3F2", "#ECE7E7"];
					const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
					paint["fill-color"] = tints[hash % tints.length];
				}
				delete paint["fill-outline-color"];
				return { ...patched, paint };
			}

			// ── Roads → gray, big roads darker ──
			if (isRoadLayer(id)) {
				const big = isBigRoad(id);
				if (id.endsWith("_casing") || id.endsWith("_outline")) {
					if (paint["line-color"] !== undefined) {
						paint["line-color"] = big ? "#4B5563" : "#9CA3AF";
					}
				} else {
					if (paint["line-color"] !== undefined) {
						paint["line-color"] = big ? "#6B7280" : "#E5E7EB";
					}
				}
				return { ...patched, paint };
			}

			// ── Shields → remove colored backgrounds ──
			if (isShieldLayer(id)) {
				if (paint["text-color"] !== undefined) {
					paint["text-color"] = "#374151";
				}
				if (paint["text-halo-color"] !== undefined) {
					paint["text-halo-color"] = "#F3F4F6";
				}
				return { ...patched, paint };
			}

			return { ...patched, paint };
		});

	return { ...style, layers: patchedLayers };
}
