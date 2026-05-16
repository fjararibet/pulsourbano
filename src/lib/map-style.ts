type Layer = Record<string, unknown>;

export async function fetchCustomStyle(): Promise<object> {
	const res = await fetch(
		"https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
	);
	const style = (await res.json()) as Record<string, unknown>;

	const layers = (style.layers as Layer[])
		.filter((layer) => layer.type !== "fill-extrusion")
		.map((layer) => {
			const id: string = (layer.id as string) || "";
			const patched = { ...layer };
			if (!patched.paint) return patched;
			const paint = { ...(patched.paint as Record<string, unknown>) };

			// Background
			if (layer.type === "background") {
				paint["background-color"] = "#fafafa";
				return { ...patched, paint };
			}

			// Land
			if (id.includes("land") || id === "landcover" || id === "landuse") {
				if (paint["fill-color"] !== undefined) paint["fill-color"] = "#fafafa";
				if (paint["fill-outline-color"] !== undefined)
					delete paint["fill-outline-color"];
				return { ...patched, paint };
			}

			// Water
			if (id.startsWith("water") || id.includes("water")) {
				if (paint["fill-color"] !== undefined) paint["fill-color"] = "#e0e0e0";
				if (paint["line-color"] !== undefined) paint["line-color"] = "#d8d8d8";
				return { ...patched, paint };
			}

			// Parks / vegetation
			if (
				id.includes("park") ||
				id.includes("garden") ||
				id.includes("wood") ||
				id.includes("forest") ||
				id.includes("grass") ||
				id.includes("meadow") ||
				id.includes("vegetation")
			) {
				if (paint["fill-color"] !== undefined) paint["fill-color"] = "#e6e6e6";
				return { ...patched, paint };
			}

			// Buildings
			if (id.includes("building")) {
				if (paint["fill-color"] !== undefined) paint["fill-color"] = "#ececec";
				if (paint["fill-outline-color"] !== undefined)
					delete paint["fill-outline-color"];
				return { ...patched, paint };
			}

			// Roads → white, casings → light gray
			const isRoad = [
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
			].some((kw) => id.includes(kw));

			if (isRoad) {
				const isCasing = id.endsWith("_casing") || id.endsWith("_outline");
				if (paint["line-color"] !== undefined) {
					paint["line-color"] = isCasing ? "#d5d5d5" : "#ffffff";
				}
				return { ...patched, paint };
			}

			// Labels → very subtle gray
			if (layer.type === "symbol") {
				if (paint["text-color"] !== undefined) paint["text-color"] = "#b0b0b0";
				if (paint["text-halo-color"] !== undefined)
					paint["text-halo-color"] = "#f5f5f5";
				return { ...patched, paint };
			}

			// Boundaries
			if (id.includes("boundary") || id.includes("admin")) {
				if (paint["line-color"] !== undefined) paint["line-color"] = "#d0d0d0";
				return { ...patched, paint };
			}

			return { ...patched, paint };
		});

	return { ...style, layers };
}
