import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "auto";

function getInitialMode(): ThemeMode {
	if (typeof window === "undefined") {
		return "auto";
	}

	const stored = window.localStorage.getItem("theme");
	if (stored === "light" || stored === "dark" || stored === "auto") {
		return stored;
	}

	return "auto";
}

function applyThemeMode(mode: ThemeMode) {
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;

	document.documentElement.classList.remove("light", "dark");
	document.documentElement.classList.add(resolved);

	if (mode === "auto") {
		document.documentElement.removeAttribute("data-theme");
	} else {
		document.documentElement.setAttribute("data-theme", mode);
	}

	document.documentElement.style.colorScheme = resolved;
}

export default function ThemeToggle() {
	const [mode, setMode] = useState<ThemeMode>("auto");

	useEffect(() => {
		const initialMode = getInitialMode();
		setMode(initialMode);
		applyThemeMode(initialMode);
	}, []);

	useEffect(() => {
		if (mode !== "auto") {
			return;
		}

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyThemeMode("auto");

		media.addEventListener("change", onChange);
		return () => {
			media.removeEventListener("change", onChange);
		};
	}, [mode]);

	function toggleMode() {
		const nextMode: ThemeMode =
			mode === "light" ? "dark" : mode === "dark" ? "auto" : "light";
		setMode(nextMode);
		applyThemeMode(nextMode);
		window.localStorage.setItem("theme", nextMode);
	}

	const label =
		mode === "auto"
			? "Tema: automático según el sistema. Cambiar a modo claro."
			: `Tema: ${mode === "dark" ? "oscuro" : "claro"}. Cambiar modo.`;
	const Icon = mode === "auto" ? Monitor : mode === "dark" ? Moon : Sun;
	const text =
		mode === "auto" ? "Automático" : mode === "dark" ? "Oscuro" : "Claro";

	return (
		<button
			type="button"
			onClick={toggleMode}
			aria-label={label}
			title={label}
			className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#b9d7d1] bg-white/90 text-[#24525b] shadow-[0_8px_22px_rgba(16,47,55,0.14)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white dark:border-white/15 dark:bg-[#0b1720]/88 dark:text-[#d8f6ff] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] dark:hover:bg-[#122432]/92"
		>
			<Icon className="h-4 w-4" aria-hidden="true" />
			<span className="sr-only">{text}</span>
		</button>
	);
}
