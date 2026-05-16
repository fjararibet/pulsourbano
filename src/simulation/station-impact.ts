export type LonLat = [number, number];

export type NearbyPlaceKind = "metro-station" | "bus-stop";

export type NearbyPlace = {
	id: string;
	name: string;
	coordinates: LonLat;
	distanceMeters: number;
	kind: NearbyPlaceKind;
};

export type StationImpact = {
	stationId: string;
	stationName: string;
	center: LonLat;
	radiusMeters: number;
	nearbyStations: NearbyPlace[];
	nearbyBusStops: NearbyPlace[];
};

export type CreateStationImpactInput = {
	stationId: string;
	stationName: string;
	center: LonLat;
	radiusMeters?: number;
	metroData: GeoJSON.FeatureCollection | null;
	busesData: GeoJSON.FeatureCollection | null;
};

type ImpactFeatureProperties = {
	impact_kind:
		| "radius"
		| "selected-station"
		| "nearby-station"
		| "nearby-bus-stop"
		| "link";
	name?: string;
	id?: string;
	distance_m?: number;
	target_kind?: NearbyPlaceKind;
	accent?: string;
};

const EARTH_RADIUS_METERS = 6_371_008.8;
export const DEFAULT_STATION_IMPACT_RADIUS_METERS = 800;
const CIRCLE_STEPS = 96;
const MAX_NEARBY_STATIONS = 8;
const MAX_NEARBY_BUS_STOPS = 40;
const MAX_LINKED_BUS_STOPS = 12;
const BRANCH_STEPS = 24;

export function createStationImpact({
	stationId,
	stationName,
	center,
	radiusMeters = DEFAULT_STATION_IMPACT_RADIUS_METERS,
	metroData,
	busesData,
}: CreateStationImpactInput): StationImpact {
	return {
		stationId,
		stationName,
		center,
		radiusMeters,
		nearbyStations: findNearbyMetroStations(
			center,
			metroData,
			radiusMeters,
			stationId,
		).slice(0, MAX_NEARBY_STATIONS),
		nearbyBusStops: findNearbyBusStops(center, busesData, radiusMeters).slice(
			0,
			MAX_NEARBY_BUS_STOPS,
		),
	};
}

export function createStationImpactFeatureCollection(
	impact: StationImpact,
	accent = "#d75235",
): GeoJSON.FeatureCollection {
	const features: GeoJSON.Feature[] = [
		createCirclePolygon(impact.center, impact.radiusMeters, accent),
		createPointFeature(impact.center, {
			impact_kind: "selected-station",
			id: impact.stationId,
			name: impact.stationName,
			accent,
		}),
	];

	for (const station of impact.nearbyStations) {
		features.push(
			createPointFeature(station.coordinates, {
				impact_kind: "nearby-station",
				id: station.id,
				name: station.name,
				distance_m: Math.round(station.distanceMeters),
				accent,
			}),
			createLinkFeature(impact.center, station, accent),
		);
	}

	for (const busStop of impact.nearbyBusStops) {
		features.push(
			createPointFeature(busStop.coordinates, {
				impact_kind: "nearby-bus-stop",
				id: busStop.id,
				name: busStop.name,
				distance_m: Math.round(busStop.distanceMeters),
				accent,
			}),
		);
	}

	for (const busStop of impact.nearbyBusStops.slice(0, MAX_LINKED_BUS_STOPS)) {
		features.push(createLinkFeature(impact.center, busStop, accent));
	}

	return {
		type: "FeatureCollection",
		features,
	};
}

export function createCirclePolygon(
	center: LonLat,
	radiusMeters: number,
	accent = "#d75235",
): GeoJSON.Feature<GeoJSON.Polygon, ImpactFeatureProperties> {
	const coordinates: LonLat[] = [];
	for (let index = 0; index < CIRCLE_STEPS; index += 1) {
		const bearing = (index / CIRCLE_STEPS) * Math.PI * 2;
		coordinates.push(destinationPoint(center, radiusMeters, bearing));
	}

	const first = coordinates[0];
	if (first) coordinates.push(first);

	return {
		type: "Feature",
		geometry: {
			type: "Polygon",
			coordinates: [coordinates],
		},
		properties: { impact_kind: "radius", accent },
	};
}

export function findNearbyMetroStations(
	center: LonLat,
	metroData: GeoJSON.FeatureCollection | null,
	radiusMeters: number,
	excludedStationId?: string,
): NearbyPlace[] {
	return findNearbyPlaces({
		center,
		data: metroData,
		radiusMeters,
		kind: "metro-station",
		excludedId: excludedStationId,
		isMatch: (feature) => feature.geometry?.type === "Point",
		getId: (feature) => getPropertyString(feature, "stop_id"),
		getName: (feature) => getPropertyString(feature, "name"),
	});
}

export function findNearbyBusStops(
	center: LonLat,
	busesData: GeoJSON.FeatureCollection | null,
	radiusMeters: number,
): NearbyPlace[] {
	return findNearbyPlaces({
		center,
		data: busesData,
		radiusMeters,
		kind: "bus-stop",
		isMatch: (feature) =>
			getPropertyString(feature, "stop_kind") === "bus_stop",
		getId: (feature) => getPropertyString(feature, "stop_id"),
		getName: (feature) => getPropertyString(feature, "name"),
	});
}

export function getDistanceMeters(from: LonLat, to: LonLat) {
	const fromLat = toRadians(from[1]);
	const toLat = toRadians(to[1]);
	const deltaLat = toRadians(to[1] - from[1]);
	const deltaLon = toRadians(to[0] - from[0]);
	const haversine =
		Math.sin(deltaLat / 2) ** 2 +
		Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;

	return (
		EARTH_RADIUS_METERS *
		2 *
		Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
	);
}

function findNearbyPlaces({
	center,
	data,
	radiusMeters,
	kind,
	excludedId,
	isMatch,
	getId,
	getName,
}: {
	center: LonLat;
	data: GeoJSON.FeatureCollection | null;
	radiusMeters: number;
	kind: NearbyPlaceKind;
	excludedId?: string | undefined;
	isMatch: (feature: GeoJSON.Feature) => boolean;
	getId: (feature: GeoJSON.Feature) => string;
	getName: (feature: GeoJSON.Feature) => string;
}) {
	if (!data) return [];

	const places: NearbyPlace[] = [];
	for (const feature of data.features) {
		if (!isMatch(feature)) continue;
		const coordinates = getPointCoordinates(feature);
		if (!coordinates) continue;

		const id = getId(feature);
		if (excludedId && id === excludedId) continue;

		const distanceMeters = getDistanceMeters(center, coordinates);
		if (distanceMeters > radiusMeters) continue;

		places.push({
			id: id || getName(feature) || `${kind}-${places.length + 1}`,
			name: getName(feature) || id || "Sin nombre",
			coordinates,
			distanceMeters,
			kind,
		});
	}

	return places.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function createPointFeature(
	coordinates: LonLat,
	properties: ImpactFeatureProperties,
): GeoJSON.Feature<GeoJSON.Point, ImpactFeatureProperties> {
	return {
		type: "Feature",
		geometry: { type: "Point", coordinates },
		properties,
	};
}

function createLinkFeature(
	center: LonLat,
	target: NearbyPlace,
	accent: string,
): GeoJSON.Feature<GeoJSON.LineString, ImpactFeatureProperties> {
	return {
		type: "Feature",
		geometry: {
			type: "LineString",
			coordinates: createBranchCoordinates(center, target),
		},
		properties: {
			impact_kind: "link",
			id: target.id,
			name: target.name,
			distance_m: Math.round(target.distanceMeters),
			target_kind: target.kind,
			accent,
		},
	};
}

function createBranchCoordinates(
	center: LonLat,
	target: NearbyPlace,
): LonLat[] {
	const targetMeters = toLocalMeters(center, target.coordinates);
	const distance = Math.hypot(targetMeters.x, targetMeters.y);
	if (distance === 0) return [center, target.coordinates];

	const direction =
		hashString(`${target.kind}:${target.id}:${target.name}`) % 2 ? 1 : -1;
	const kindWeight = target.kind === "metro-station" ? 1.2 : 0.82;
	const curveMeters = clamp(distance * 0.2 * kindWeight, 32, 135) * direction;
	const midpoint = { x: targetMeters.x * 0.5, y: targetMeters.y * 0.5 };
	const normal = {
		x: -targetMeters.y / distance,
		y: targetMeters.x / distance,
	};
	const control = {
		x: midpoint.x + normal.x * curveMeters,
		y: midpoint.y + normal.y * curveMeters,
	};
	const coordinates: LonLat[] = [];

	for (let index = 0; index <= BRANCH_STEPS; index += 1) {
		const t = index / BRANCH_STEPS;
		const oneMinusT = 1 - t;
		const point = {
			x:
				oneMinusT * oneMinusT * 0 +
				2 * oneMinusT * t * control.x +
				t * t * targetMeters.x,
			y:
				oneMinusT * oneMinusT * 0 +
				2 * oneMinusT * t * control.y +
				t * t * targetMeters.y,
		};
		coordinates.push(fromLocalMeters(center, point));
	}

	return coordinates;
}

function toLocalMeters(origin: LonLat, point: LonLat) {
	const metersPerLatitude = 111_320;
	const metersPerLongitude = metersPerLatitude * Math.cos(toRadians(origin[1]));
	return {
		x: (point[0] - origin[0]) * metersPerLongitude,
		y: (point[1] - origin[1]) * metersPerLatitude,
	};
}

function fromLocalMeters(
	origin: LonLat,
	point: { x: number; y: number },
): LonLat {
	const metersPerLatitude = 111_320;
	const metersPerLongitude = metersPerLatitude * Math.cos(toRadians(origin[1]));
	return [
		origin[0] + point.x / metersPerLongitude,
		origin[1] + point.y / metersPerLatitude,
	];
}

function hashString(value: string) {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
	}
	return hash;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function getPointCoordinates(feature: GeoJSON.Feature): LonLat | null {
	if (feature.geometry?.type !== "Point") return null;
	const [longitude, latitude] = feature.geometry.coordinates;
	if (typeof longitude !== "number" || typeof latitude !== "number")
		return null;
	return [longitude, latitude];
}

function getPropertyString(feature: GeoJSON.Feature, key: string) {
	const value = feature.properties?.[key];
	if (value === null || value === undefined) return "";
	return String(value).trim();
}

function destinationPoint(
	center: LonLat,
	radiusMeters: number,
	bearingRadians: number,
): LonLat {
	const [longitude, latitude] = center;
	const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
	const lat1 = toRadians(latitude);
	const lon1 = toRadians(longitude);
	const sinLat1 = Math.sin(lat1);
	const cosLat1 = Math.cos(lat1);
	const sinAngularDistance = Math.sin(angularDistance);
	const cosAngularDistance = Math.cos(angularDistance);
	const lat2 = Math.asin(
		sinLat1 * cosAngularDistance +
			cosLat1 * sinAngularDistance * Math.cos(bearingRadians),
	);
	const lon2 =
		lon1 +
		Math.atan2(
			Math.sin(bearingRadians) * sinAngularDistance * cosLat1,
			cosAngularDistance - sinLat1 * Math.sin(lat2),
		);

	return [toDegrees(lon2), toDegrees(lat2)];
}

function toRadians(degrees: number) {
	return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number) {
	return (radians * 180) / Math.PI;
}
