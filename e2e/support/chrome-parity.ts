/**
 * Turning chrome measurements into a report of where the bindings disagree.
 *
 * Two axes matter, and conflating them produces a misleading report. The first
 * is the React reference, because every other binding is a port of it. The
 * second is the token the shared module pins, because React/Vue/Angular render
 * the title bar from `TITLE_BAR_CLASSES` and are supposed to paint it exactly.
 * When the reference itself has drifted off its own token, a binding that still
 * paints the token is not the binding at fault, so each line names all three
 * values and says which side is wrong.
 *
 * Every comparison here returns lines rather than asserting, so a spec can
 * aggregate all five bindings into one assertion: a per-binding assertion stops
 * at the first failure, and a defect shared by four bindings then reads as a
 * defect in one.
 *
 * @module e2e/support/chrome-parity
 */
import type { ChromeMeasurement, ZoomProbe } from './chrome';
import { REFERENCE } from './frameworks';
import type { FrameworkResult } from './parity';
import { colorsMatch, splitReference } from './parity';

/** One measured chrome property. */
interface MetricSpec {
	key: string;
	label: string;
	kind: 'px' | 'color' | 'exact';
	/** The value `packages/shared/src/render/title-bar.ts` pins, where it does. */
	contract?: number | string;
}

/** Half a pixel: see {@link TOLERANCE}. */
const PX = 0.5;

/**
 * How far a measurement may drift before it counts as a difference.
 *
 * Chrome metrics are authored in whole CSS pixels and measured at a device
 * pixel ratio of 1, so half a pixel sits below anything a stylesheet here can
 * express while still absorbing flex/border layout rounding. That budget is
 * what makes a 1px drift (a 27px switch track against the shared 28px) a
 * reportable difference rather than noise. Colours get the same per-channel
 * budget as the slide-render parity harness; tokens must match exactly.
 */
const TOLERANCE: Record<MetricSpec['kind'], number> = { px: PX, color: 3, exact: 0 };

/** Title-bar metrics, with the `TITLE_BAR_CLASSES` token each one comes from. */
const TITLE_BAR_METRICS: readonly MetricSpec[] = [
	{ key: 'barHeight', label: 'title bar height', kind: 'px', contract: 36 },
	{ key: 'barGap', label: 'title bar column gap', kind: 'px', contract: 4 },
	{ key: 'barPadLeft', label: 'title bar left padding', kind: 'px', contract: 8 },
	{ key: 'barPadRight', label: 'title bar right padding', kind: 'px', contract: 8 },
	{ key: 'barFontSize', label: 'title bar font-size', kind: 'px', contract: 11 },
	{
		key: 'logoBackground',
		label: 'app logo background',
		kind: 'color',
		contract: 'rgb(196, 62, 28)',
	},
	{ key: 'logoWidth', label: 'app logo width', kind: 'px', contract: 20 },
	{ key: 'logoHeight', label: 'app logo height', kind: 'px', contract: 20 },
	{ key: 'logoFontSize', label: 'app logo font-size', kind: 'px', contract: 10 },
	{ key: 'toggleChecked', label: 'AutoSave switch state', kind: 'exact' },
	{ key: 'trackWidth', label: 'AutoSave track width', kind: 'px', contract: 28 },
	{ key: 'trackHeight', label: 'AutoSave track height', kind: 'px', contract: 14 },
	{ key: 'knobWidth', label: 'AutoSave knob width', kind: 'px', contract: 10 },
	{ key: 'knobHeight', label: 'AutoSave knob height', kind: 'px', contract: 10 },
	{ key: 'knobOffset', label: 'AutoSave knob offset when on', kind: 'px', contract: 15 },
	{ key: 'fileFontSize', label: 'file-name font-size', kind: 'px', contract: 12 },
	{ key: 'fileWeight', label: 'file-name font-weight', kind: 'exact', contract: '500' },
];

/** Status-bar metrics. No binding builds the status bar from shared tokens. */
const STATUS_BAR_METRICS: readonly MetricSpec[] = [
	{ key: 'statusHeight', label: 'status bar height', kind: 'px' },
	{ key: 'statusFontSize', label: 'status bar font-size', kind: 'px' },
];

function format(spec: MetricSpec, value: number | string | null): string {
	return value === null ? 'absent' : spec.kind === 'px' ? `${String(value)}px` : String(value);
}

function agrees(spec: MetricSpec, value: number | string | null, other: number | string): boolean {
	return spec.kind === 'color'
		? colorsMatch(String(value), String(other), TOLERANCE.color)
		: spec.kind === 'exact'
			? String(value) === String(other)
			: typeof value === 'number' && Math.abs(value - Number(other)) <= TOLERANCE.px;
}

/** One line per (binding, metric) that is off the reference or off the token. */
function compareMetrics(
	specs: readonly MetricSpec[],
	results: FrameworkResult<ChromeMeasurement>[],
): string[] {
	const { reference } = splitReference(results);
	return results.flatMap((result) =>
		specs.flatMap((spec) => {
			const name = result.framework.name;
			const value = result.value.metrics[spec.key] ?? null;
			const referenceValue = reference.value.metrics[spec.key] ?? null;
			const isReference = name === REFERENCE.name;
			const offReference =
				!isReference && (referenceValue === null || !agrees(spec, value, referenceValue));
			const offContract = spec.contract !== undefined && !agrees(spec, value, spec.contract);
			if (!offReference && !offContract) {
				return [];
			}
			const shown = format(spec, value);
			if (isReference) {
				return [
					`${name}: ${spec.label} is ${shown}, but the shared token pins ` +
						`${format(spec, spec.contract ?? '')} (the reference itself is what drifted)`,
				];
			}
			if (spec.contract !== undefined && !offContract) {
				return [
					`${name}: ${spec.label} is ${shown}, which is the shared token; the ${REFERENCE.name} ` +
						`reference paints ${format(spec, referenceValue)} instead`,
				];
			}
			const contractNote =
				spec.contract === undefined ? '' : `, shared token ${format(spec, spec.contract)}`;
			return [
				`${name}: ${spec.label} is ${shown} ` +
					`(${REFERENCE.name} reference ${format(spec, referenceValue)}${contractNote})`,
			];
		}),
	);
}

function compareList(
	results: FrameworkResult<ChromeMeasurement>[],
	label: string,
	pick: (measurement: ChromeMeasurement) => string[],
): string[] {
	const { reference, candidates } = splitReference(results);
	const expected = pick(reference.value).join(' | ');
	return candidates.flatMap((candidate) => {
		const actual = pick(candidate.value).join(' | ');
		return actual === expected
			? []
			: [`${candidate.framework.name}: ${label} is [${actual}], reference has [${expected}]`];
	});
}

/** Every title-bar disagreement, across every binding. */
export function titleBarProblems(results: FrameworkResult<ChromeMeasurement>[]): string[] {
	return [
		...results.flatMap((result) =>
			result.value.titleBarPresent ? [] : [`${result.framework.name}: renders no title bar`],
		),
		...compareMetrics(TITLE_BAR_METRICS, results),
	];
}

/** Every status-bar disagreement, across every binding. */
export function statusBarProblems(results: FrameworkResult<ChromeMeasurement>[]): string[] {
	return [
		...results.flatMap((result) => {
			const { counterText, saveText, statusBarPresent, ambiguousToolbars } = result.value;
			const name = result.framework.name;
			return [
				...(statusBarPresent ? [] : [`${name}: renders no status bar`]),
				...(counterText === null ? [`${name}: the status bar has no "Slide n of m" counter`] : []),
				...(saveText === null ? [`${name}: the status bar has no dirty/saved indicator`] : []),
				...ambiguousToolbars.map(
					(label) =>
						`${name}: a role="toolbar" region is named "${label}", which is also the name of a ` +
						`control inside it, so the region and the button are indistinguishable by name`,
				),
			];
		}),
		...compareMetrics(STATUS_BAR_METRICS, results),
		...compareList(results, 'the status-bar controls', (m) => m.statusButtons),
		...compareList(results, 'the status-bar readouts', (m) => m.statusTexts),
		...compareList(results, 'the status-bar landmark', (m) => [
			`role=${String(m.statusBarRole)}`,
			`name=${String(m.statusBarName)}`,
		]),
	];
}

/** Every quick-access / title-bar-search disagreement, across every binding. */
export function quickAccessProblems(results: FrameworkResult<ChromeMeasurement>[]): string[] {
	return [
		...results.flatMap((result) =>
			result.value.searchFields.length > 0
				? []
				: [`${result.framework.name}: the title bar has no command-search field (parity gap)`],
		),
		...results.flatMap((result) =>
			result.value.quickAccess.length > 0
				? []
				: [`${result.framework.name}: the title bar has no quick-access buttons (parity gap)`],
		),
		...compareList(results, 'the quick-access strip', (m) => m.quickAccess),
		...compareList(results, 'the title-bar search fields', (m) => m.searchFields),
	];
}

/**
 * Zoom problems: the controls must move the stage, zoom-to-fit must undo them,
 * and one step must be the same size everywhere.
 *
 * The step is compared as a ratio with a 2% budget. It is a multiplier the
 * bindings share by contract, and taking it against each binding's own fitted
 * width keeps the check independent of how much chrome a demo wraps the stage
 * in. The 1px floor on "did it move at all" is there so a control that does
 * nothing cannot pass on layout rounding.
 */
export function zoomProblems(results: FrameworkResult<ZoomProbe>[]): string[] {
	const { reference } = splitReference(results);
	const step = (probe: ZoomProbe): number =>
		Math.round((probe.zoomedIn / probe.fitted) * 1000) / 1000;
	const referenceStep = step(reference.value);
	return results.flatMap((result) => {
		const { fitted, zoomedIn, zoomedOut, refitted } = result.value;
		const name = result.framework.name;
		return [
			...(zoomedIn > fitted + 1
				? []
				: [`${name}: zoom in left the stage at ${zoomedIn}px, from ${fitted}px`]),
			...(zoomedOut < zoomedIn - 1
				? []
				: [`${name}: zoom out left the stage at ${zoomedOut}px, from ${zoomedIn}px`]),
			...(Math.abs(refitted - fitted) <= fitted * 0.01
				? []
				: [`${name}: zoom to fit gave ${refitted}px, not the ${fitted}px it first fitted to`]),
			...(Math.abs(step(result.value) - referenceStep) <= 0.02
				? []
				: [
						`${name}: one zoom-in step scales the stage by ${step(result.value)}x, ` +
							`the ${REFERENCE.name} reference steps by ${referenceStep}x`,
					]),
		];
	});
}
