import { createFileRoute } from "@tanstack/react-router";
import { SantiagoMapPage } from "#/map/SantiagoMapPage";

export const Route = createFileRoute("/")({
	component: SantiagoMapPage,
	ssr: false,
});
