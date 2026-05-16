import { createFileRoute } from "@tanstack/react-router";
import CityMap from "../components/CityMap";

function App() {
	return (
		<div className="h-[calc(100dvh-3.5rem)] w-full">
			<CityMap />
		</div>
	);
}

export const Route = createFileRoute("/")({ component: App });
