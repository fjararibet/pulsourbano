export interface ValhallaLocation {
	lat: number;
	lon: number;
	type: "break";
}

export interface ValhallaRouteRequest {
	locations: ValhallaLocation[];
	costing: string;
}

export interface ValhallaRouteResponse {
	trip: {
		legs: {
			shape: string;
		}[];
		summary: {
			time: number;
			distance: number;
		};
	};
}

export type CostingMode = "auto" | "bus" | "bicycle" | "pedestrian";

export interface RouteResult {
	shape: [number, number][];
	time: number;
	distance: number;
}

export async function runValhallaRoute(
	from: [number, number],
	to: [number, number],
	costing: CostingMode,
): Promise<RouteResult> {
	const request: ValhallaRouteRequest = {
		locations: [
			{ lat: from[1], lon: from[0], type: "break" },
			{ lat: to[1], lon: to[0], type: "break" },
		],
		costing,
	};

	const response = await fetch("/valhalla-route", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});

	if (!response.ok) {
		throw new Error(`Valhalla route failed: ${response.statusText}`);
	}

	const data: ValhallaRouteResponse = await response.json();
	const leg = data.trip.legs[0];
	if (!leg) throw new Error("Valhalla returned no legs");
	const shape = decodePolyline(leg.shape);
	return {
		shape,
		time: data.trip.summary.time,
		distance: data.trip.summary.distance,
	};
}

function decodePolyline(encoded: string): [number, number][] {
	const coordinates: [number, number][] = [];
	let index = 0;
	let lat = 0;
	let lng = 0;

	while (index < encoded.length) {
		let b: number;
		let shift = 0;
		let result = 0;

		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);

		const dLat = result & 1 ? ~(result >> 1) : result >> 1;
		lat += dLat;

		shift = 0;
		result = 0;

		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);

		const dLng = result & 1 ? ~(result >> 1) : result >> 1;
		lng += dLng;

		coordinates.push([lng / 1e6, lat / 1e6]);
	}

	return coordinates;
}
