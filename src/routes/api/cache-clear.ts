import { createFileRoute } from "@tanstack/react-router";
import { clearCache } from "#/lib/cache-clear";

export const Route = createFileRoute("/api/cache-clear")({
	// @ts-expect-error handler is a TanStack Start server function handler
	handler: () => clearCache(),
});
