import type { LayerId } from "./config";

export type LayerVisibility = Record<LayerId, boolean>;

export type HoverInfo = {
	kind: string;
	title: string;
	description: string;
	accent: string;
} | null;

export type FrequencyInfo = {
	mean_headway_s: number;
	samples: number;
};

export type FrequencyMap = Record<string, FrequencyInfo>;
