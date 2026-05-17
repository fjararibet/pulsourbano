import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getComparadorStats } from "#/lib/comparador/stats.fn";

const searchSchema = z.object({
	origen: z.string().optional(),
	destino: z.string().optional(),
});

export const Route = createFileRoute("/api/comparador/stats")({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({
		origen: search.origen ?? "",
		destino: search.destino ?? "",
	}),
	loader: async ({ deps }) => {
		if (!deps.origen || !deps.destino) {
			return { statsModo: [], total: 0, initialStatsMap: {} };
		}
		const result = await getComparadorStats({
			data: { origen: deps.origen, destino: deps.destino },
		});
		console.log(
			"[api/comparador/stats]",
			deps.origen,
			"→",
			deps.destino,
			result,
		);
		return result;
	},
});
