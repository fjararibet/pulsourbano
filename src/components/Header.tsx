import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import ThemeToggle from "./ThemeToggle";
import CityBadge from "./CityBadge";

export default function Header() {
	const navigate = useNavigate();
	const search = useRouterState({ select: (s) => s.location.search });
	const panelOpen =
		typeof search === "object" && search
			? Boolean((search as Record<string, unknown>).aq)
			: false;

	const handleToggle = () => {
		navigate({ to: "/", search: panelOpen ? {} : { aq: 1 } });
	};

	return (
		<header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) px-4 backdrop-blur-lg">
			<nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
				<h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
					<Link
						to="/"
						className="inline-flex items-center gap-2 rounded-full border border-(--chip-line) bg-(--chip-bg) px-3 py-1.5 text-sm text-(--sea-ink) no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
					>
						<span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
						Esgrima
					</Link>
				</h2>

				<div className="order-3 flex w-full items-center justify-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-2 sm:w-auto sm:flex-nowrap sm:pb-0">
					<CityBadge />
				</div>

				<div className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2">
					<button
						onClick={handleToggle}
						className={`rounded-full border px-3 py-1.5 text-sm font-semibold shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition hover:-translate-y-0.5 ${
							panelOpen
								? "border-(--lagoon) bg-(--lagoon) text-white"
								: "border-(--chip-line) bg-(--chip-bg) text-(--sea-ink)"
						}`}
						aria-label={
							panelOpen ? "Cerrar calidad del aire" : "Ver calidad del aire"
						}
						title="Calidad del Aire"
						type="button"
					>
						<span className="flex items-center gap-1.5">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="size-4"
								aria-hidden="true"
							>
								<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Z" />
								<path d="M12 6v6l4 2" />
							</svg>
							AQ
						</span>
					</button>
					<ThemeToggle />
				</div>
			</nav>
		</header>
	);
}
