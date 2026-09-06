/**
 * Pure serialization helper for writing a chart's title (`c:title` /
 * `cx:title`) back into the parsed chart XML tree on save.
 *
 * Mirrors `chart-legend-serializer`: it creates the node when the model now
 * carries a title, removes it when the model says there is none, and leaves
 * the XML alone when the model is silent, so untouched charts round-trip
 * through their original markup.
 *
 * @module utils/chart-title-serializer
 */

import type { PptxChartTitleRun, XmlObject } from '../types';
import { buildTitleNode, buildTitleText, buildTitleTextFromRuns } from './chart-title-node-builder';
import { realignOrCollapseTitleRuns } from './chart-title-run-alignment';
import type { GetLocalName } from './chart-title-xml-ops';
import {
	collectAllText,
	findKey,
	insertAt,
	replaceFirstText,
	setAutoTitleDeleted,
} from './chart-title-xml-ops';

/** The title-relevant subset of `PptxChartData` / `PptxChartStyle`. */
export interface ChartTitleModel {
	/** The title text; `''` clears the title, `undefined` leaves it alone. */
	title?: string;
	/** Explicit visibility; wins over `title` when it is `false`. */
	hasTitle?: boolean;
	/**
	 * Lossless multi-run title text (`PptxChartData.titleRuns`). When present
	 * and non-empty, this REPLACES the rich body with one run per entry
	 * (each carrying its own bold/italic/size/color), taking priority over
	 * {@link title}'s single-run patch. `title` is still expected to carry
	 * the flat, first-run text alongside it (as the parser always produces),
	 * so a consumer that ignores `titleRuns` keeps working. `prefix: 'cx'`
	 * ignores this field: ChartEx titles are out of scope (see the module
	 * doc on `chart-title-runs-parser.ts`).
	 *
	 * When {@link title} has diverged from this array's first run (a caller
	 * edited the flat text without updating `titleRuns`, the shape every
	 * pre-existing consumer's edit takes) and this array has more than one
	 * run, the edit is realigned onto the existing runs by text position
	 * (`distributeTitleRunsText`) rather than discarded: an appended suffix
	 * lands on the last run, an edit confined to one run only changes that
	 * run, and every other run's text and style survive untouched. Only when
	 * no such alignment exists (an unrelated rewrite) does it collapse to a
	 * SINGLE run carrying the first run's formatting and the whole new text,
	 * dropping every other run, matching what PowerPoint itself does when you
	 * retype a chart title.
	 */
	titleRuns?: PptxChartTitleRun[];
}

export interface ChartTitleOptions {
	/**
	 * Namespace prefix of the chart part: `c` for a 2006 DrawingML chart
	 * (`c:title`, with `c:autoTitleDeleted`), `cx` for a 2014 ChartEx part
	 * (`cx:title`, which has no auto-title flag).
	 */
	prefix: 'c' | 'cx';
}

/**
 * Apply the model's title onto a chart root node (`c:chart` or `cx:chart`).
 *
 * - `hasTitle === false`, or `title === ''` without an explicit `hasTitle`,
 *   removes the title node (and sets `c:autoTitleDeleted val="1"` on a
 *   2006 chart so PowerPoint does not re-synthesise one).
 * - A non-empty `title` ensures the node exists (inserted first, which is
 *   its schema position in both `CT_Chart` and `CT_ChartEx`) and rewrites its
 *   first text run; `hasTitle === true` with no text creates an empty
 *   (auto) title. Either way `c:autoTitleDeleted` becomes `0`.
 * - Both `undefined` leaves the XML untouched.
 *
 * Mutates `chartRoot` in place and returns whether a title node remains.
 */
export function applyChartTitleToXml(
	chartRoot: XmlObject,
	model: ChartTitleModel,
	getLocalName: GetLocalName,
	options: ChartTitleOptions = { prefix: 'c' },
): boolean {
	const { prefix } = options;
	const existingKey = findKey(chartRoot, 'title', getLocalName);
	const remove = model.hasTitle === false || (model.title === '' && model.hasTitle !== true);

	if (remove) {
		if (existingKey) {
			delete chartRoot[existingKey];
		}
		if (prefix === 'c') {
			setAutoTitleDeleted(chartRoot, true, getLocalName);
		}
		return false;
	}
	if (model.title === undefined && model.hasTitle !== true) {
		return existingKey !== undefined;
	}

	// ChartEx titles are out of scope for the multi-run path (see
	// `ChartTitleModel.titleRuns`'s doc). Also ignored when `title` has
	// diverged from `titleRuns`' FIRST run (the parser always sets `title` to
	// just the first run's text, matching `replaceFirstText`'s own single-run
	// semantics; the joined text of every run is a DIFFERENT string whenever
	// there is more than one run, so comparing against that would treat a
	// perfectly in-sync pair as stale). `titleRuns` is populated on every
	// load (even a trivial single-run title), so a caller that edits only
	// the flat `title` field - every pre-existing consumer, since
	// `titleRuns` did not exist before this field was added - would
	// otherwise have that edit silently overwritten by the stale, unedited
	// `titleRuns` on save. Diverged `title` is treated as the caller's
	// explicit intent to replace the (possibly richer) run data with plain
	// text, exactly like `replaceFirstText` already does for the existing
	// single-run case below.
	const runsFirstText = model.titleRuns?.[0]?.text;
	const runsStale =
		model.title !== undefined && runsFirstText !== undefined && model.title !== runsFirstText;
	let runs =
		prefix === 'c' && model.titleRuns && model.titleRuns.length > 0 && !runsStale
			? model.titleRuns
			: undefined;

	// A stale MULTI-run title (more than one differently-styled run) is not
	// necessarily an unrelated rewrite: when the edited `title` still contains
	// every other run's text in order (an append, an insertion, or a rewrite
	// confined to one run), `realignOrCollapseTitleRuns` realigns the runs onto
	// it instead of falling through to the single-run patch below, which would
	// otherwise leave every run after the first with its now-orphaned stale
	// text. Only when no such alignment survives (an unrelated full rewrite)
	// does it collapse to a single run instead (see its own doc). A
	// single-run title keeps the existing single-run in-place patch unchanged.
	const staleRuns = model.titleRuns;
	if (
		prefix === 'c' &&
		runsStale &&
		model.title !== undefined &&
		staleRuns &&
		staleRuns.length > 1
	) {
		runs = realignOrCollapseTitleRuns(staleRuns, model.title);
	}

	let titleNode = existingKey ? (chartRoot[existingKey] as XmlObject | undefined) : undefined;

	// An untouched multi-run title (every run's TEXT matches what is already
	// authored, in order) skips the rebuild entirely: rebuilding from the
	// narrow `PptxChartTitleRun` shape only re-emits bold/italic/size/color
	// as a literal `a:srgbClr`, which would silently downgrade an authored
	// `a:schemeClr` theme reference (or drop an attribute this type does not
	// model, e.g. `a:latin`) on every save even when nothing changed. Falling
	// through to the single-run `replaceFirstText` path below is a genuine
	// no-op here (it rewrites the first run's text to the SAME value) and
	// leaves every other run - and its formatting - byte-identical.
	if (runs && titleNode && typeof titleNode === 'object') {
		const existingTexts: string[] = [];
		collectAllText(titleNode, getLocalName, existingTexts);
		const newTexts = runs.map((run) => run.text);
		if (
			existingTexts.length === newTexts.length &&
			existingTexts.every((text, index) => text === newTexts[index])
		) {
			runs = undefined;
		}
	}
	if (!titleNode || typeof titleNode !== 'object') {
		titleNode = buildTitleNode(prefix, model.title, runs);
		if (existingKey) {
			chartRoot[existingKey] = titleNode;
		} else {
			insertAt(chartRoot, 0, `${prefix}:title`, titleNode);
		}
	} else if (runs) {
		// Multi-run text REPLACES the whole rich body rather than patching the
		// first run in place, since a prior save may have had a different
		// number of runs.
		const txKey = findKey(titleNode, 'tx', getLocalName);
		if (txKey) {
			titleNode[txKey] = buildTitleTextFromRuns(prefix, runs);
		} else {
			insertAt(titleNode, 0, `${prefix}:tx`, buildTitleTextFromRuns(prefix, runs));
		}
	} else if (model.title !== undefined && !replaceFirstText(titleNode, model.title, getLocalName)) {
		// A title node without any run (an auto title): give it explicit text.
		const txKey = findKey(titleNode, 'tx', getLocalName);
		if (txKey) {
			titleNode[txKey] = buildTitleText(prefix, model.title);
		} else {
			insertAt(titleNode, 0, `${prefix}:tx`, buildTitleText(prefix, model.title));
		}
	}
	if (prefix === 'c') {
		setAutoTitleDeleted(chartRoot, false, getLocalName);
	}
	return true;
}
