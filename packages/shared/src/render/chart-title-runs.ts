/**
 * Chart title rich text: per-run render spans and the flat-text-edit
 * collapse rule.
 *
 * `PptxChartData.titleRuns` (core) carries the title's per-run bold/italic/
 * size/colour, parsed from `c:title/c:tx/c:rich`; until this module, no
 * binding read it, so a title with several differently-styled runs rendered
 * (and re-saved) as one flat string in a single style. `resolveChartTitleRunSpans`
 * gives every binding a framework-neutral list of `<tspan>` descriptors to
 * draw instead of the single flat `vm.title` text node.
 * `collapseChartTitleRunsForEdit` is the companion write-side rule: when an
 * inspector's flat title-text field is edited, a MULTI-run body collapses to
 * ONE run in the title's dominant style (the run covering most of the
 * text), rather than leaving other runs' stale text behind - see
 * `chart-title-serializer.ts`'s `runsStale` doc for why an edited `title`
 * and an untouched `titleRuns` must not silently disagree. A single-run
 * title is left to the flat `title` patch alone: core's serializer already
 * patches that one run's text in place, preserving whatever formatting this
 * narrow typed model does not carry (e.g. a `schemeClr` reference).
 *
 * @module chart-title-runs
 */
import type { PptxChartData, PptxChartTitleRun } from 'pptx-viewer-core';

import { chartFontPx } from './chart-font';
import { resolveChartTitleTextStyle } from './chart-title-style';

/** One resolved `<tspan>` for a chart title run. */
export interface ChartTitleRunSpan {
	/** This run's text (`a:t`). */
	text: string;
	/** `font-size`, in slide-px. */
	fontSize: number;
	/** `font-weight`. */
	fontWeight: number;
	/** `font-style`, only when the run is italic. */
	fontStyle?: 'italic';
	/** `fill`. */
	fill: string;
	/** `font-family`, only when the title names a typeface. */
	fontFamily?: string;
}

/**
 * Resolve `chartData.titleRuns` into per-run SVG `<tspan>` descriptors, each
 * run's own bold/italic/size/colour falling back to the title's cascade
 * (`resolveChartTitleTextStyle`) for whatever it does not override.
 *
 * Returns `undefined` when the title has no typed runs at all (an auto/plain
 * title, or one authored as a linked-cell reference), so a binding should
 * keep rendering the flat `vm.title` in `vm.titleStyle` unchanged. A single
 * run still resolves to a one-element array: this lets a per-run override
 * (e.g. italic on the title's only run) render even when
 * `resolveChartTitleTextStyle`'s coarser `chartData.style.titleFont*` cascade
 * does not carry it.
 */
export function resolveChartTitleRunSpans(
	chartData: PptxChartData | undefined,
): ChartTitleRunSpan[] | undefined {
	const runs = chartData?.titleRuns;
	if (!runs || runs.length === 0) {
		return undefined;
	}
	const base = resolveChartTitleTextStyle(chartData);
	return runs.map((run) => ({
		text: run.text,
		fontSize: run.fontSize !== undefined ? chartFontPx(run.fontSize) : base.fontSize,
		fontWeight: run.bold !== undefined ? (run.bold ? 700 : 400) : base.fontWeight,
		...(run.italic ? { fontStyle: 'italic' as const } : {}),
		fill: run.color ?? base.fill,
		...(base.fontFamily ? { fontFamily: base.fontFamily } : {}),
	}));
}

/**
 * The dominant style among `runs`: the longest run's (by text length; ties
 * keep the first), since that is the style covering most of the visible
 * title text.
 */
function dominantRunStyle(runs: readonly PptxChartTitleRun[]): Omit<PptxChartTitleRun, 'text'> {
	let best = runs[0];
	for (const run of runs.slice(1)) {
		if (run.text.length > best.text.length) {
			best = run;
		}
	}
	const { bold, italic, fontSize, color } = best;
	return {
		...(bold !== undefined ? { bold } : {}),
		...(italic !== undefined ? { italic } : {}),
		...(fontSize !== undefined ? { fontSize } : {}),
		...(color !== undefined ? { color } : {}),
	};
}

/**
 * Compute the `{ title, titleRuns }` patch for an inspector's flat title-text
 * field being edited to `newText`. Every binding's chart title input should
 * call this instead of patching `title` alone.
 *
 * A title with zero or one run just gets the new flat text (`titleRuns`
 * untouched, letting core's single-run patch path preserve that run's full
 * authored formatting). A title with two or more runs collapses to ONE run
 * carrying `newText` in the dominant style, so the edit does not leave a
 * second, now-stale run's text trailing the new title.
 */
export function collapseChartTitleRunsForEdit(
	chartData: PptxChartData | undefined,
	newText: string,
): Pick<PptxChartData, 'title' | 'titleRuns'> {
	const runs = chartData?.titleRuns;
	if (!runs || runs.length <= 1) {
		return { title: newText };
	}
	return { title: newText, titleRuns: [{ ...dominantRunStyle(runs), text: newText }] };
}
