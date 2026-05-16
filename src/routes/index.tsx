import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<main className="flex min-h-[calc(100vh-64px)] items-center justify-center">
			<h1 className="text-6xl font-bold tracking-tight sm:text-8xl md:text-9xl">
				Esgrima
			</h1>
		</main>
	);
}
