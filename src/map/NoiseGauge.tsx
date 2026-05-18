/**
 * Gauge semicircular de nivel de ruido ambiental.
 * SVG puro, sin dependencias externas.
 *
 * Geometría:
 *   Centro       (80, 100)   viewBox 0 0 160 128
 *   Radio ext.   68          Radio int. 52
 *   Arco         de 160° a 20° sentido horario (pasando por 270°/arriba) = 220° total
 *   Rango dB     30 → 85
 */
import { NOISE_BANDS, NOISE_DB_MAX, NOISE_DB_MIN } from "./noise";

/** Centro del gauge. */
const CX = 80;
const CY = 100;
const R_OUT = 68;
const R_IN = 52;
/** Ángulo SVG del extremo izquierdo (30 dB). 0° = derecha, sentido horario. */
const ANGLE_START = 160;
const ANGLE_SWEEP = 220;
/** Gap en grados entre segmentos para separación visual. */
const GAP_DEG = 1.5;

/** Convierte un valor dB al ángulo SVG correspondiente en el arco. */
function dbToAngle(db: number): number {
	const safeDb = Math.min(NOISE_DB_MAX, Math.max(NOISE_DB_MIN, db));
	return (
		ANGLE_START +
		((safeDb - NOISE_DB_MIN) / (NOISE_DB_MAX - NOISE_DB_MIN)) * ANGLE_SWEEP
	);
}

function fmt(n: number): string {
	return n.toFixed(3);
}

/**
 * Genera el path SVG de un sector anular (arco coloreado).
 * Va de startDeg a endDeg en sentido horario.
 */
function annularSector(
	startDeg: number,
	endDeg: number,
	rOuter: number,
	rInner: number,
): string {
	const toRad = (d: number) => (d * Math.PI) / 180;
	const c1 = Math.cos(toRad(startDeg));
	const s1 = Math.sin(toRad(startDeg));
	const c2 = Math.cos(toRad(endDeg));
	const s2 = Math.sin(toRad(endDeg));
	const sweep = (endDeg - startDeg + 360) % 360;
	const large = sweep > 180 ? 1 : 0;
	return (
		`M ${fmt(CX + rOuter * c1)} ${fmt(CY + rOuter * s1)} ` +
		`A ${rOuter} ${rOuter} 0 ${large} 1 ${fmt(CX + rOuter * c2)} ${fmt(CY + rOuter * s2)} ` +
		`L ${fmt(CX + rInner * c2)} ${fmt(CY + rInner * s2)} ` +
		`A ${rInner} ${rInner} 0 ${large} 0 ${fmt(CX + rInner * c1)} ${fmt(CY + rInner * s1)} Z`
	);
}

/** Segmentos de arco precalculados — constantes, se computan una sola vez. */
const SEGMENT_PATHS = NOISE_BANDS.map(({ lo, hi, color }) => ({
	key: lo,
	color,
	d: annularSector(
		dbToAngle(lo) + GAP_DEG,
		dbToAngle(hi) - GAP_DEG,
		R_OUT,
		R_IN,
	),
}));

interface NoiseGaugeProps {
	/** Valor promedio de dB. Null cuando no hay polígono seleccionado. */
	db: number | null;
	compact?: boolean;
}

/**
 * Gauge semicircular de nivel de ruido.
 * La aguja marca el valor dbPromedio con CSS transition.
 */
export function NoiseGauge({ db, compact = false }: NoiseGaugeProps) {
	const hasValue = db !== null;
	const needleAngle = hasValue
		? dbToAngle(db)
		: dbToAngle((NOISE_DB_MIN + NOISE_DB_MAX) / 2);
	const rotation = needleAngle - 270;
	const label = hasValue ? `${db.toFixed(1)} dB(A)` : "— dB(A)";
	const activeColor = hasValue ? "#dc2626" : "#94a3b8";
	const textColor = hasValue ? "var(--noise-gauge-text)" : "#9ca3af";
	const width = compact ? 112 : 148;
	const height = compact ? 90 : 118;

	return (
		<div className="flex flex-col items-center">
			<svg
				viewBox="0 0 160 128"
				width={width}
				height={height}
				aria-label="Medidor de nivel de ruido"
			>
				{/* Segmentos de arco coloreados */}
				{SEGMENT_PATHS.map(({ key, d, color }) => (
					<path key={key} d={d} fill={color} opacity={hasValue ? 1 : 0.55} />
				))}

				{/* Etiqueta "dB" en el interior del arco */}
				<text
					x={CX}
					y={CY - 16}
					textAnchor="middle"
					dominantBaseline="middle"
					fontSize="13"
					fontWeight="800"
					fill={textColor}
					fontFamily="system-ui, -apple-system, sans-serif"
				>
					dB
				</text>

				{/* Aguja animada — rota alrededor del pivote (CX, CY) */}
				<g
					style={{
						transform: `rotate(${rotation.toFixed(2)}deg)`,
						transformOrigin: `${CX}px ${CY}px`,
						transition: "transform 0.4s ease-out",
					}}
				>
					{/* Halo suave */}
					<line
						x1={CX}
						y1={CY + 8}
						x2={CX}
						y2={CY - 54}
						stroke={activeColor}
						strokeWidth="7"
						strokeLinecap="round"
						opacity="0.15"
					/>
					{/* Cuerpo de la aguja */}
					<line
						x1={CX}
						y1={CY + 8}
						x2={CX}
						y2={CY - 54}
						stroke={activeColor}
						strokeWidth="2.5"
						strokeLinecap="round"
					/>
				</g>

				{/* Pivote central */}
				<circle cx={CX} cy={CY} r="6" fill={activeColor} />
				<circle cx={CX} cy={CY} r="2.5" fill="white" />
			</svg>

			{/* Valor dB escrito bajo la aguja */}
			<p
				className={`-mt-2 text-[12px] font-black tabular-nums leading-none tracking-tight ${
					hasValue ? "text-[#102f37] dark:text-[#e8f3f6]" : "text-[#9ca3af]"
				}`}
			>
				{label}
			</p>
		</div>
	);
}
