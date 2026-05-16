import { mockStations } from "./air-quality-mock";

export interface StationFieldData {
	id: string;
	name: string;
	lat: number;
	lng: number;
	aqi: number;
}

export const fieldStations: StationFieldData[] = mockStations.map((s) => ({
	id: s.id,
	name: s.name,
	lat: s.latitude,
	lng: s.longitude,
	aqi: s.aqi.value,
}));

export const FIELD_PARAMS = {
	baseAqi: 25,
	sigma: 0.035,
	noiseScale: 800.0,
	noiseIntensity: 15.0,
	westBiasLng: -70.7,
	westBiasFactor: 1.3,
	opacity: 0.35,
};

export const fieldConfig = {
	enabled: true as boolean,
	bounds: null as {
		south: number;
		north: number;
		west: number;
		east: number;
	} | null,
};

export function computeAqiAt(lat: number, lng: number): number {
	let aqi = FIELD_PARAMS.baseAqi;

	for (const station of fieldStations) {
		const dLat = lat - station.lat;
		const dLng = lng - station.lng;
		const dist2 = dLat * dLat + dLng * dLng;
		const contribution =
			station.aqi *
			Math.exp(-dist2 / (2 * FIELD_PARAMS.sigma * FIELD_PARAMS.sigma));
		aqi += contribution;
	}

	if (lng < FIELD_PARAMS.westBiasLng) {
		aqi *= FIELD_PARAMS.westBiasFactor;
	}

	return Math.max(0, Math.min(500, Math.round(aqi)));
}
