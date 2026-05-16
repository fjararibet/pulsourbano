import { createFileRoute } from "@tanstack/react-router";

function App() {
	return (
		<main className="flex min-h-[calc(100vh-64px)] items-center justify-center">
			<h1 className="font-bold text-6xl tracking-tight sm:text-8xl md:text-9xl">
				Esgrima
			</h1>
		</main>
	);
}

export const Route = createFileRoute("/")({ component: App });
