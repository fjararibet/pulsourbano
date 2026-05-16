import { describe, expect, it } from "vitest";
import {
	createCirclePolygon,
	createStationImpact,
	createStationImpactFeatureCollection,
	findNearbyBusStops,
	findNearbyMetroStations,
	getDistanceMeters,
	type LonLat,
} from "./station-impact";

const center: LonLat = [-70.5896635, -33.415419];

const metroData: GeoJSON.FeatureCollection = {
	type: "FeatureCollection",
	features: [
		pointFeature(center, { stop_id: "AL", name: "Alcántara" }),
		pointFeature([-70.588, -33.416], { stop_id: "NEAR", name: "Cercana" }),
		pointFeature([-70.62, -33.45], { stop_id: "FAR", name: "Lejana" }),
	],
};

const busesData: GeoJSON.FeatureCollection = {
	type: "FeatureCollection",
	features: [
		pointFeature([-70.5905, -33.4158], {
			stop_id: "PA1",
			name: "Paradero cercano",
			stop_kind: "bus_stop",
		}),
		pointFeature([-70.6205, -33.4558], {
			stop_id: "PA2",
			name: "Paradero lejano",
			stop_kind: "bus_stop",
		}),
		pointFeature([-70.5902, -33.4155], {
			stop_id: "NO_BUS",
			name: "Otro punto",
		}),
	],
};

describe("station-impact geo helpers", () => {
	it("calculates distance in meters", () => {
		expect(getDistanceMeters(center, center)).toBe(0);
		expect(getDistanceMeters([0, 0], [0, 0.008993])).toBeGreaterThan(990);
		expect(getDistanceMeters([0, 0], [0, 0.008993])).toBeLessThan(1_010);
	});

	it("creates a closed circle polygon", () => {
		const circle = createCirclePolygon(center, 800);
		const ring = circle.geometry.coordinates[0];
		const first = ring?.[0];
		const last = ring?.[ring.length - 1];

		expect(ring?.length).toBe(97);
		expect(first).toEqual(last);
	});

	it("finds nearby stations and excludes the selected one", () => {
		const nearbyStations = findNearbyMetroStations(
			center,
			metroData,
			800,
			"AL",
		);

		expect(nearbyStations.map((station) => station.id)).toEqual(["NEAR"]);
	});

	it("finds only nearby bus stops", () => {
		const nearbyBusStops = findNearbyBusStops(center, busesData, 800);

		expect(nearbyBusStops.map((busStop) => busStop.id)).toEqual(["PA1"]);
	});

	it("creates visual impact features", () => {
		const impact = createStationImpact({
			stationId: "AL",
			stationName: "Alcántara",
			center,
			metroData,
			busesData,
		});
		const collection = createStationImpactFeatureCollection(impact);
		const link = collection.features.find(
			(feature) => feature.properties?.impact_kind === "link",
		);

		expect(collection.features.length).toBeGreaterThan(3);
		expect(
			collection.features.some(
				(feature) => feature.properties?.impact_kind === "selected-station",
			),
		).toBe(true);
		expect(link?.geometry.type).toBe("LineString");
		if (link?.geometry.type === "LineString") {
			expect(link.geometry.coordinates.length).toBeGreaterThan(2);
		}
		expect(link?.properties?.target_kind).toBe("metro-station");
	});
});

function pointFeature(
	coordinates: LonLat,
	properties: Record<string, string>,
): GeoJSON.Feature<GeoJSON.Point> {
	return {
		type: "Feature",
		geometry: { type: "Point", coordinates },
		properties,
	};
}
