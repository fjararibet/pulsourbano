import type { LayerId } from "./config";

export type LayerVisibility = Record<LayerId, boolean>;

export type HoverInfo = {
	kind: string;
	title: string;
	description: string;
	accent: string;
	popupTitle?: string;
	popupDescription?: string;
	details?: string[];
	note?: string;
	pinned?: boolean;
} | null;

export type FrequencyInfo = {
	mean_headway_s: number;
	samples: number;
};

export type FrequencyMap = Record<string, FrequencyInfo>;

export type TravelTimeInfo = {
	mean_minutes: number;
	mean_km: number;
	avg_kmh: number;
	samples: number;
};

export type TravelTimeMap = Record<string, TravelTimeInfo>;
