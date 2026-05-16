import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import Header from "../components/Header";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "SimSantiago" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	notFoundComponent: NotFound,
	shellComponent: RootDocument,
});

function NotFound() {
	return (
		<main className="grid min-h-[100svh] place-items-center bg-[#edf4e8] px-6 text-center text-[#102f37]">
			<div className="rounded-[28px] border border-white/70 bg-white/82 p-8 shadow-[0_24px_70px_rgba(16,47,55,0.16)] backdrop-blur-xl">
				<p className="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-[#168a76]">
					SimSantiago
				</p>
				<h1 className="m-0 mt-2 text-3xl font-black tracking-[-0.04em]">
					Ruta no encontrada
				</h1>
				<a
					href="/"
					className="mt-6 inline-flex rounded-full bg-[#102f37] px-5 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#1c4851]"
				>
					Volver al mapa
				</a>
			</div>
		</main>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="es" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<Header />
				{children}
				<Scripts />
			</body>
		</html>
	);
}
