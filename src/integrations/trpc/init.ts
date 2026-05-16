import { initTRPC } from "@trpc/server";
import superjson from "superjson";

const t = initTRPC.create({
	transformer: superjson,
});

export const createTrpcRouter = t.router;
export const publicProcedure = t.procedure;
