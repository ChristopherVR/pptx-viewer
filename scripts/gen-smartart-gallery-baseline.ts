/**
 * Regenerate `packages/core/src/__tests__/fixtures/smartart-gallery/baseline.json`,
 * the per-fixture progress log for the DiagramML layout engine.
 *
 * Mirrors `smartart-gallery-ground-truth.test.ts` exactly: shapes are keyed
 * by trimmed text (largest area wins a tie), and each fixture records
 *
 * - `matched`/`cachedTotal`/`interpretedTotal`: text-keyed shape counts,
 * - `maxDeltaFraction`: the worst x/y/w/h deviation among matched pairs, as a
 *   fraction of the diagram's bounding size,
 * - `presetOk`/`fontOk`: every matched pair has the same preset / font size
 *   (within 0.5pt, as the test's `toBeCloseTo(x, 0)` checks),
 * - `gate`: the whole acceptance gate passes (same count, all matched,
 *   presets, fonts and geometry within 1%).
 *
 * The test does NOT consult this file; it is a ratchet log. Run with
 * `--compare` to diff the current engine against the committed file without
 * rewriting it (exit code 1 when a fixture that was within 1% no longer is).
 *
 * Usage: `bun run scripts/gen-smartart-gallery-baseline.ts [--compare] [--only <substr>]`
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from '../packages/core/src/core/PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../packages/core/src/core/types/elements';
import {
	computeSmartArtElementsWithoutCache,
	decomposeSmartArt,
} from '../packages/core/src/core/utils';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GALLERY_DIR = path.resolve(HERE, '../packages/core/src/__tests__/fixtures/smartart-gallery');

interface ManifestEntry {
	file: string;
	layoutName: string;
	category: string;
	dataset: string;
}

interface BaselineEntry {
	matched: number;
	cachedTotal: number;
	interpretedTotal: number;
	maxDeltaFraction: number;
	presetOk: boolean;
	fontOk: boolean;
	gate: boolean;
}

function readFixture(fileName: string): ArrayBuffer {
	const buf = readFileSync(path.join(GALLERY_DIR, fileName));
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

type ShapeEl = Extract<PptxElement, { type: 'shape' }>;

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

const EMPTY: BaselineEntry = {
	matched: 0,
	cachedTotal: 0,
	interpretedTotal: 0,
	maxDeltaFraction: 1,
	presetOk: false,
	fontOk: false,
	gate: false,
};

async function evaluate(fileName: string): Promise<BaselineEntry> {
	const handler = new PptxHandler();
	const { slides } = await handler.load(readFixture(fileName));
	const element = slides
		.flatMap((s) => s.elements)
		.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
	if (!element?.smartArtData) {
		return EMPTY;
	}
	const bounds = { x: element.x, y: element.y, width: element.width, height: element.height };
	const cachedByText = textKeyed(decomposeSmartArt(element.smartArtData, bounds) ?? []);
	let interpretedEls: PptxElement[] = [];
	try {
		interpretedEls = computeSmartArtElementsWithoutCache(element.smartArtData, bounds) ?? [];
	} catch (err) {
		console.error(fileName, err);
		return EMPTY;
	}
	const interpretedByText = textKeyed(interpretedEls);
	const boundW = Math.max(1, element.width);
	const boundH = Math.max(1, element.height);
	let matched = 0;
	let maxDeltaFraction = 0;
	let presetOk = true;
	let fontOk = true;
	for (const [text, cached] of cachedByText) {
		const interpreted = interpretedByText.get(text);
		if (!interpreted) {
			continue;
		}
		matched++;
		if (interpreted.shapeType !== cached.shapeType) {
			presetOk = false;
		}
		const cachedFont = cached.textStyle?.fontSize ?? 0;
		const font = interpreted.textStyle?.fontSize;
		if (font === undefined || Math.abs(font - cachedFont) >= 0.5) {
			fontOk = false;
		}
		maxDeltaFraction = Math.max(
			maxDeltaFraction,
			Math.abs(cached.x - interpreted.x) / boundW,
			Math.abs(cached.y - interpreted.y) / boundH,
			Math.abs(cached.width - interpreted.width) / boundW,
			Math.abs(cached.height - interpreted.height) / boundH,
		);
	}
	const structural =
		cachedByText.size > 0 &&
		interpretedByText.size === cachedByText.size &&
		matched === cachedByText.size;
	if (matched === 0) {
		presetOk = false;
		fontOk = false;
		maxDeltaFraction = 1;
	}
	return {
		matched,
		cachedTotal: cachedByText.size,
		interpretedTotal: interpretedByText.size,
		maxDeltaFraction: Math.round(maxDeltaFraction * 10000) / 10000,
		presetOk,
		fontOk,
		gate: structural && presetOk && fontOk && maxDeltaFraction <= 0.01,
	};
}

function isStructural(r: BaselineEntry): boolean {
	return r.cachedTotal > 0 && r.matched === r.cachedTotal && r.interpretedTotal === r.cachedTotal;
}

function summarize(baseline: Record<string, BaselineEntry>): string {
	const rows = Object.values(baseline);
	const within = (f: number) => rows.filter((r) => r.matched > 0 && r.maxDeltaFraction <= f).length;
	return [
		`fixtures ${rows.length}`,
		`structural ${rows.filter(isStructural).length}`,
		`geom<=1% ${within(0.01)}`,
		`<=5% ${within(0.05)}`,
		`<=10% ${within(0.1)}`,
		`<=50% ${within(0.5)}`,
		`preset ${rows.filter((r) => r.presetOk).length}`,
		`font ${rows.filter((r) => r.fontOk).length}`,
		`gate ${rows.filter((r) => r.gate).length}`,
	].join(' | ');
}

function compareAgainst(sorted: Record<string, BaselineEntry>): void {
	const previous = JSON.parse(
		readFileSync(path.join(GALLERY_DIR, 'baseline.json'), 'utf-8'),
	) as Record<string, Partial<BaselineEntry>>;
	let regressions = 0;
	for (const [file, now] of Object.entries(sorted)) {
		const before = previous[file];
		if (!before) {
			continue;
		}
		const wasWithin =
			(before.maxDeltaFraction ?? 1) <= 0.01 && before.matched === before.cachedTotal;
		const isWithin = now.maxDeltaFraction <= 0.01 && now.matched === now.cachedTotal;
		const delta = now.maxDeltaFraction - (before.maxDeltaFraction ?? 1);
		const flags = [
			wasWithin && !isWithin ? 'REGRESSED' : '',
			!wasWithin && isWithin ? 'NEW<=1%' : '',
			before.fontOk === false && now.fontOk ? '+font' : '',
			before.fontOk && !now.fontOk ? '-font' : '',
			before.presetOk === false && now.presetOk ? '+preset' : '',
			before.presetOk && !now.presetOk ? '-preset' : '',
			before.gate === false && now.gate ? '+gate' : '',
			before.gate && !now.gate ? '-gate' : '',
		].filter(Boolean);
		if (wasWithin && !isWithin) {
			regressions++;
		}
		if (flags.length > 0 || Math.abs(delta) > 0.0005) {
			console.log(
				`${file.padEnd(58)} ${String(before.maxDeltaFraction).padStart(7)} -> ${String(now.maxDeltaFraction).padStart(7)} ${flags.join(' ')}`,
			);
		}
	}
	if (regressions > 0) {
		console.log(`${regressions} fixture(s) regressed out of the 1% band`);
		process.exitCode = 1;
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const compare = args.includes('--compare');
	const onlyIdx = args.indexOf('--only');
	const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
	const manifest = JSON.parse(
		readFileSync(path.join(GALLERY_DIR, 'manifest.json'), 'utf-8'),
	) as ManifestEntry[];
	const onDisk = new Set(readdirSync(GALLERY_DIR).filter((f) => f.endsWith('.pptx')));
	const baseline: Record<string, BaselineEntry> = {};
	for (const entry of manifest) {
		if (!onDisk.has(entry.file) || (only && !entry.file.includes(only))) {
			continue;
		}
		baseline[entry.file] = await evaluate(entry.file);
	}
	const sorted: Record<string, BaselineEntry> = {};
	for (const key of Object.keys(baseline).sort()) {
		sorted[key] = baseline[key];
	}
	console.log(summarize(sorted));
	if (compare || only) {
		compareAgainst(sorted);
		return;
	}
	writeFileSync(path.join(GALLERY_DIR, 'baseline.json'), `${JSON.stringify(sorted, null, 2)}\n`);
	console.log(`Wrote baseline for ${Object.keys(sorted).length} fixtures.`);
}

main().catch((err: unknown) => {
	console.error(err);
	process.exitCode = 1;
});
