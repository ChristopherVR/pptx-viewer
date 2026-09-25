/**
 * Compare the legacy family-based DiagramML interpreter against the
 * per-point layout engine INDEPENDENTLY (bypassing the "legacy first, engine
 * only as a fallback" chain `computeDiagramMlElements` runs in production),
 * grouped by `layoutDefinition.uniqueId`, to find layouts where the engine
 * should be tried FIRST instead.
 *
 * Both engines are scored against the SAME ground truth every other
 * SmartArt gate measurement uses: the fixture's own cached `dsp:drawing`
 * (`decomposeSmartArt`), matched by node text exactly like
 * `smartart-gallery-ground-truth.test.ts` and `gen-smartart-gallery-
 * baseline.ts` do.
 *
 * A layoutDef uniqueId is added to the printed allowlist only when, across
 * EVERY dataset fixture that declares it:
 *
 *   - the engine drops no shape the legacy interpreter matched (no
 *     shape-set loss: `engine.matched >= legacy.matched`), and
 *   - the engine's worst geometry deviation is never larger than legacy's
 *     (`engine.maxDeltaFraction <= legacy.maxDeltaFraction`), and
 *   - where the two deviations TIE, the engine matches the cached font size
 *     on at least as many shapes as legacy (`fontMatched`, the same 0.5pt
 *     tolerance the gallery gate uses),
 *
 * and STRICTLY better on at least one dataset: a smaller deviation, or a
 * tied deviation with more font matches. Font matches only ever break a
 * geometry tie, so a layout the engine lays out measurably better is never
 * held back by its font sizes, and a layout where the two engines tie on
 * both everywhere does not churn the routing for no measured benefit.
 *
 * Usage: `bun run scripts/measure-smartart-engine-vs-legacy.ts [--only <substr>] [--json]`
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from '../packages/core/src/core/PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../packages/core/src/core/types/elements';
import { decomposeSmartArt } from '../packages/core/src/core/utils';
import { runEngineLayout } from '../packages/core/src/core/utils/smartart-engine/engine-to-result';
import { interpretedLayoutToElements } from '../packages/core/src/core/utils/smartart-interpreter-drawing-bridge';
import { interpretSmartArtLayout } from '../packages/core/src/core/utils/smartart-layout-interpreter';
import { flattenNodes } from '../packages/core/src/core/utils/smartart-layout-style-helpers';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GALLERY_DIR = path.resolve(HERE, '../packages/core/src/__tests__/fixtures/smartart-gallery');

interface ManifestEntry {
	file: string;
	layoutName: string;
	category: string;
	dataset: string;
}

interface EngineMetric {
	matched: number;
	cachedTotal: number;
	interpretedTotal: number;
	maxDeltaFraction: number;
	/** Matched shapes whose font size is within 0.5 of the cached one. */
	fontMatched: number;
	declined: boolean;
}

const DECLINED: EngineMetric = {
	matched: 0,
	cachedTotal: 0,
	interpretedTotal: 0,
	maxDeltaFraction: 1,
	fontMatched: 0,
	declined: true,
};

type ShapeEl = Extract<PptxElement, { type: 'shape' }>;

function readFixture(fileName: string): ArrayBuffer {
	const buf = readFileSync(path.join(GALLERY_DIR, fileName));
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function textKeyed(elements: PptxElement[]): Map<string, ShapeEl> {
	const map = new Map<string, ShapeEl>();
	for (const el of elements) {
		if (el.type !== 'shape') {
			continue;
		}
		const text = (el.text ?? el.textSegments?.map((s) => s.text).join('') ?? '').trim();
		if (text.length === 0) {
			continue;
		}
		const existing = map.get(text);
		if (!existing || el.width * el.height > existing.width * existing.height) {
			map.set(text, el);
		}
	}
	return map;
}

function scoreAgainstCached(
	cachedByText: Map<string, ShapeEl>,
	interpreted: PptxElement[] | undefined,
	boundW: number,
	boundH: number,
): EngineMetric {
	if (!interpreted || interpreted.length === 0) {
		return { ...DECLINED, cachedTotal: cachedByText.size };
	}
	const interpretedByText = textKeyed(interpreted);
	let matched = 0;
	let fontMatched = 0;
	let maxDeltaFraction = 0;
	for (const [text, cached] of cachedByText) {
		const found = interpretedByText.get(text);
		if (!found) {
			continue;
		}
		matched++;
		const font = found.textStyle?.fontSize;
		if (font !== undefined && Math.abs(font - (cached.textStyle?.fontSize ?? 0)) < 0.5) {
			fontMatched++;
		}
		maxDeltaFraction = Math.max(
			maxDeltaFraction,
			Math.abs(cached.x - found.x) / boundW,
			Math.abs(cached.y - found.y) / boundH,
			Math.abs(cached.width - found.width) / boundW,
			Math.abs(cached.height - found.height) / boundH,
		);
	}
	if (matched === 0) {
		maxDeltaFraction = 1;
	}
	return {
		matched,
		cachedTotal: cachedByText.size,
		interpretedTotal: interpretedByText.size,
		maxDeltaFraction: Math.round(maxDeltaFraction * 10000) / 10000,
		fontMatched,
		declined: false,
	};
}

interface FixtureComparison {
	file: string;
	layoutName: string;
	uniqueId?: string;
	legacy: EngineMetric;
	engine: EngineMetric;
}

async function compareFixture(entry: ManifestEntry): Promise<FixtureComparison | undefined> {
	const handler = new PptxHandler();
	const { slides } = await handler.load(readFixture(entry.file));
	const element = slides
		.flatMap((s) => s.elements)
		.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
	const data = element?.smartArtData;
	if (!data || !data.layoutDefinition) {
		return undefined;
	}
	const bounds = { x: element.x, y: element.y, width: element.width, height: element.height };
	const cachedByText = textKeyed(decomposeSmartArt(data, bounds) ?? []);
	const boundW = Math.max(1, element.width);
	const boundH = Math.max(1, element.height);
	if (cachedByText.size === 0) {
		return undefined;
	}

	const flat = flattenNodes(data.nodes ?? []);
	const style = data.style ?? 'flat';
	const palette =
		data.colorTransform?.fillColors && data.colorTransform.fillColors.length > 0
			? data.colorTransform.fillColors
			: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
	const bulletEnabled = data.presLayoutVars?.bulletEnabled;

	let legacyElements: PptxElement[] | undefined;
	try {
		const legacyResult = interpretSmartArtLayout({
			layoutDefinition: data.layoutDefinition,
			nodes: data.nodes ?? [],
			flat,
			box: { width: bounds.width, height: bounds.height },
			palette,
			style,
			elementId: 'smartart-measure-legacy',
			presLayoutVars: data.presLayoutVars,
			colorRoles: data.colorTransform?.roleColors,
			connections: data.connections,
			fontName: data.themeMinorFont,
		});
		legacyElements = legacyResult
			? interpretedLayoutToElements(
					legacyResult,
					data.nodes ?? [],
					bounds,
					bulletEnabled,
					data.connections,
				)
			: undefined;
	} catch {
		legacyElements = undefined;
	}

	let engineElements: PptxElement[] | undefined;
	try {
		const engineResult = runEngineLayout(data, bounds, data.nodes ?? [], palette, style);
		engineElements = engineResult
			? interpretedLayoutToElements(
					engineResult,
					data.nodes ?? [],
					bounds,
					bulletEnabled,
					data.connections,
				)
			: undefined;
	} catch {
		engineElements = undefined;
	}

	return {
		file: entry.file,
		layoutName: entry.layoutName,
		uniqueId: data.layoutDefinition.uniqueId,
		legacy: scoreAgainstCached(cachedByText, legacyElements, boundW, boundH),
		engine: scoreAgainstCached(cachedByText, engineElements, boundW, boundH),
	};
}

interface LayoutVerdict {
	uniqueId: string;
	layoutName: string;
	datasets: number;
	engineBetterOnEvery: boolean;
	strictlyBetterSomewhere: boolean;
	worstLegacyDelta: number;
	worstEngineDelta: number;
	recommend: boolean;
}

function summarizeByLayout(comparisons: FixtureComparison[]): LayoutVerdict[] {
	const byLayout = new Map<string, FixtureComparison[]>();
	for (const c of comparisons) {
		if (!c.uniqueId) {
			continue;
		}
		const list = byLayout.get(c.uniqueId) ?? [];
		list.push(c);
		byLayout.set(c.uniqueId, list);
	}
	const verdicts: LayoutVerdict[] = [];
	for (const [uniqueId, list] of byLayout) {
		let engineBetterOnEvery = true;
		let strictlyBetterSomewhere = false;
		let worstLegacyDelta = 0;
		let worstEngineDelta = 0;
		for (const c of list) {
			const noShapeLoss = c.engine.matched >= c.legacy.matched;
			const notWorse = c.engine.maxDeltaFraction <= c.legacy.maxDeltaFraction + 1e-9;
			const geometryTie = Math.abs(c.engine.maxDeltaFraction - c.legacy.maxDeltaFraction) <= 1e-9;
			// Font matches only decide a geometry tie: a strictly smaller
			// deviation wins on its own, as it always has.
			const noFontLossOnTie = !geometryTie || c.engine.fontMatched >= c.legacy.fontMatched;
			if (!noShapeLoss || !notWorse || !noFontLossOnTie) {
				engineBetterOnEvery = false;
			}
			if (
				c.engine.maxDeltaFraction < c.legacy.maxDeltaFraction - 1e-9 ||
				(geometryTie && c.engine.fontMatched > c.legacy.fontMatched)
			) {
				strictlyBetterSomewhere = true;
			}
			worstLegacyDelta = Math.max(worstLegacyDelta, c.legacy.maxDeltaFraction);
			worstEngineDelta = Math.max(worstEngineDelta, c.engine.maxDeltaFraction);
		}
		verdicts.push({
			uniqueId,
			layoutName: list[0].layoutName,
			datasets: list.length,
			engineBetterOnEvery,
			strictlyBetterSomewhere,
			worstLegacyDelta: Math.round(worstLegacyDelta * 10000) / 10000,
			worstEngineDelta: Math.round(worstEngineDelta * 10000) / 10000,
			recommend: engineBetterOnEvery && strictlyBetterSomewhere,
		});
	}
	return verdicts.sort((a, b) => a.layoutName.localeCompare(b.layoutName));
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const onlyIdx = args.indexOf('--only');
	const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
	const asJson = args.includes('--json');

	const manifest = JSON.parse(
		readFileSync(path.join(GALLERY_DIR, 'manifest.json'), 'utf-8'),
	) as ManifestEntry[];
	const onDisk = new Set(readdirSync(GALLERY_DIR).filter((f) => f.endsWith('.pptx')));

	const comparisons: FixtureComparison[] = [];
	for (const entry of manifest) {
		if (!onDisk.has(entry.file) || (only && !entry.file.includes(only))) {
			continue;
		}
		const result = await compareFixture(entry);
		if (result) {
			comparisons.push(result);
		}
	}

	const verdicts = summarizeByLayout(comparisons);
	const recommended = verdicts.filter((v) => v.recommend);

	if (asJson) {
		console.log(JSON.stringify({ comparisons, verdicts }, null, 2));
		return;
	}

	console.log(`Compared ${comparisons.length} fixtures across ${verdicts.length} layouts.\n`);
	for (const v of verdicts) {
		const flag = v.recommend ? 'ENGINE-FIRST' : '';
		console.log(
			`${v.layoutName.padEnd(34)} ${v.uniqueId.padEnd(28)} datasets=${v.datasets} legacy<=${v.worstLegacyDelta} engine<=${v.worstEngineDelta} ${flag}`,
		);
	}
	console.log(`\n${recommended.length} of ${verdicts.length} layouts recommended engine-first:`);
	for (const v of recommended) {
		console.log(`  ${v.uniqueId} (${v.layoutName})`);
	}
}

main().catch((err: unknown) => {
	console.error(err);
	process.exitCode = 1;
});
