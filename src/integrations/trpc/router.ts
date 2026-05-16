import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "./init";
import { mockStations } from "#/lib/air-quality-mock";
import type { TRPCRouterRecord } from "@trpc/server";

const airQualityRouter = {
	list: publicProcedure.query(() => mockStations),
	byId: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ input }) => {
			const station = mockStations.find((s) => s.id === input.id);
			if (!station) throw new Error("Station not found");
			return station;
		}),
} satisfies TRPCRouterRecord;

export const trpcRouter = createTRPCRouter({
	airQuality: airQualityRouter,
});
export type TRPCRouter = typeof trpcRouter;
