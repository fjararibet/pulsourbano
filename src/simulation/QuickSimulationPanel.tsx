import {
	calculateQuickSimulation,
	calculateQuickSimulationRanges,
	type QuickSimulationInput,
	type ScenarioDirection,
} from "./quick-simulation";

type NumericField = Exclude<keyof QuickSimulationInput, "direction">;

const integerFormatter = new Intl.NumberFormat("es-CL", {
	maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("es-CL", {
	maximumFractionDigits: 1,
});

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cfe0dd] bg-white/82 px-3 py-2 text-sm font-bold text-[#102f37] shadow-inner outline-none transition focus:border-[#5bb6a6] focus:bg-white";

type QuickSimulationPanelProps = {
	input: QuickSimulationInput;
	onInputChange: (input: QuickSimulationInput) => void;
};

export function QuickSimulationPanel({
	input,
	onInputChange,
}: QuickSimulationPanelProps) {
	const result = calculateQuickSimulation(input);
	const ranges = calculateQuickSimulationRanges(input);
	const isOpening = input.direction === "opening";
	const accent = isOpening ? "#168a76" : "#d75235";
	const impactWord = isOpening ? "evitadas" : "extra";

	const updateNumber = (field: NumericField, value: string) => {
		const nextValue = Number(value);
		onInputChange({
			...input,
			[field]: Number.isFinite(nextValue) ? nextValue : 0,
		});
	};

	const updateDirection = (direction: ScenarioDirection) => {
		onInputChange({ ...input, direction });
	};

	return (
		<section className="mt-4 rounded-3xl border border-[#d9e7e4] bg-white/72 p-3 shadow-sm">
			<header className="mb-3 flex items-start justify-between gap-3">
				<div>
					<p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-[#168a76]">
						Simulación rápida
					</p>
					<h2 className="m-0 mt-0.5 text-base font-black tracking-[-0.03em] text-[#102f37]">
						CO2 por cambio modal
					</h2>
				</div>
				<span
					className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white"
					style={{ backgroundColor: accent }}
				>
					{isOpening ? "Apertura" : "Cierre"}
				</span>
			</header>

			<div className="grid gap-3">
				<label className="text-xs font-black text-[#315a61]">
					Tipo de escenario
					<select
						className={inputClass}
						value={input.direction}
						onChange={(event) =>
							updateDirection(event.currentTarget.value as ScenarioDirection)
						}
					>
						<option value="closure">Cierre de Metro</option>
						<option value="opening">Apertura de Metro</option>
					</select>
				</label>

				<div className="grid grid-cols-2 gap-2">
					<NumberField
						label="Viajes afectados/día"
						min={0}
						step={1_000}
						value={input.affectedTrips}
						onChange={(value) => updateNumber("affectedTrips", value)}
					/>
					<NumberField
						label={isOpening ? "Deja auto" : "Pasa a auto"}
						min={0}
						max={100}
						step={1}
						suffix="%"
						value={input.shiftToCarPct}
						onChange={(value) => updateNumber("shiftToCarPct", value)}
					/>
					<NumberField
						label="Distancia auto"
						min={0}
						step={0.5}
						suffix="km"
						value={input.avgCarDistanceKm}
						onChange={(value) => updateNumber("avgCarDistanceKm", value)}
					/>
					<NumberField
						label="Ocupación auto"
						min={0}
						step={0.1}
						value={input.carOccupancy}
						onChange={(value) => updateNumber("carOccupancy", value)}
					/>
					<NumberField
						label="Factor CO2"
						min={0}
						step={0.01}
						suffix="kg/km"
						value={input.emissionKgCo2PerKm}
						onChange={(value) => updateNumber("emissionKgCo2PerKm", value)}
					/>
					<NumberField
						label="Días/año"
						min={0}
						step={1}
						value={input.annualDays}
						onChange={(value) => updateNumber("annualDays", value)}
					/>
				</div>
			</div>

			<div className="mt-3 grid grid-cols-2 gap-2">
				<MetricCard
					label="Viajes-auto/día"
					value={formatSigned(result.carTrips, "integer")}
					accent={accent}
				/>
				<MetricCard
					label="Veh-km/día"
					value={formatSigned(result.vehicleKmPerDay, "integer")}
					accent={accent}
				/>
				<MetricCard
					label={`Kg CO2/día ${impactWord}`}
					value={formatSigned(result.kgCo2PerDay, "integer")}
					accent={accent}
				/>
				<MetricCard
					label={`Ton CO2/año ${impactWord}`}
					value={formatSigned(result.tonCo2PerYear, "decimal")}
					accent={accent}
				/>
			</div>

			<div className="mt-3 rounded-2xl border border-[#d9e7e4] bg-[#f5faf7] p-3">
				<div className="mb-2 flex items-center justify-between gap-2">
					<p className="m-0 text-xs font-black text-[#102f37]">
						Rangos de sensibilidad
					</p>
					<p className="m-0 text-[10px] font-black uppercase tracking-[0.12em] text-[#5b777c]">
						10 · 25 · 40%
					</p>
				</div>
				<div className="grid gap-1.5">
					{ranges.map((range) => (
						<div
							key={range.id}
							className="grid grid-cols-[64px_1fr] items-center gap-2 rounded-xl bg-white/78 px-2.5 py-2 text-xs"
						>
							<span className="font-black text-[#315a61]">{range.label}</span>
							<span className="text-right font-black tabular-nums text-[#102f37]">
								{formatSigned(range.result.kgCo2PerDay, "integer")} kg/día ·{" "}
								{formatSigned(range.result.tonCo2PerYear, "decimal")} ton/año
							</span>
						</div>
					))}
				</div>
			</div>

			<p className="m-0 mt-3 text-[11px] font-semibold leading-4 text-[#5b777c]">
				Estimación exploratoria sin EOD: viajes afectados x cambio modal /
				ocupación x distancia x factor CO2. Los valores son supuestos editables.
			</p>
		</section>
	);
}

type NumberFieldProps = {
	label: string;
	value: number;
	min: number;
	max?: number;
	step: number;
	suffix?: string;
	onChange: (value: string) => void;
};

function NumberField({
	label,
	value,
	min,
	max,
	step,
	suffix,
	onChange,
}: NumberFieldProps) {
	return (
		<label className="text-xs font-black text-[#315a61]">
			<span className="flex items-center justify-between gap-2">
				<span>{label}</span>
				{suffix ? (
					<span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#789197]">
						{suffix}
					</span>
				) : null}
			</span>
			<input
				className={inputClass}
				type="number"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) => onChange(event.currentTarget.value)}
			/>
		</label>
	);
}

type MetricCardProps = {
	label: string;
	value: string;
	accent: string;
};

function MetricCard({ label, value, accent }: MetricCardProps) {
	return (
		<div className="rounded-2xl border border-[#d9e7e4] bg-white/78 p-2.5">
			<p className="m-0 text-[10px] font-black uppercase tracking-[0.12em] text-[#5b777c]">
				{label}
			</p>
			<p
				className="m-0 mt-1 text-lg font-black tracking-[-0.04em] tabular-nums"
				style={{ color: accent }}
			>
				{value}
			</p>
		</div>
	);
}

function formatSigned(value: number, precision: "integer" | "decimal") {
	const formatter =
		precision === "integer" ? integerFormatter : decimalFormatter;
	const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
	return `${prefix}${formatter.format(Math.abs(value))}`;
}
