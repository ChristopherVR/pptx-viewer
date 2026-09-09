/**
 * Regenerate `packages/core/src/__tests__/fixtures/smartart-gallery/baseline.json`,
 * the ratchet baseline `smartart-gallery-ground-truth.test.ts` compares the
 * DiagramML interpreter against.
 *
 * The baseline records, per fixture, how many cached-drawing node shapes the
 * interpreter currently reproduces (`matched`/`cachedTotal`/`interpretedTotal`)
 * and the worst x/y/width/height deviation among the matched pairs
 * (`maxDeltaFraction`, as a fraction of the diagram's own bounding size). The
 * ground-truth test asserts CURRENT interpreter output is no worse than this
 * file, so a genuine interpreter fix (which improves matched/maxDeltaFraction
 * for one or more fixtures) requires re-running this script and committing the
 * updated `baseline.json` alongside it - the diff makes exactly which layouts
 * improved visible in review. A regression (a change that makes some fixture's
 * numbers worse) fails `smartart-gallery-ground-truth.test.ts` without needing
 * a baseline update, by design.
 *
 * Usage: `bun run scripts/gen-smartart-gallery-baseline.ts`
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
		if (text.length === 0 || map.has(text)) {
			continue;
		}
		map.set(text, el);
	}
	return map;
}

async function evaluate(fileName: string): Promise<BaselineEntry> {
	const handler = new PptxHandler();
	const { slides } = await handler.load(readFixture(fileName));
	const element = slides
		.flatMap((s) => s.elements)
		.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
	if (!element?.smartArtData) {
		return { matched: 0, cachedTotal: 0, interpretedTotal: 0, maxDeltaFraction: 1 };
	}
	const bounds = { x: element.x, y: element.y, width: element.width, height: element.height };
	const cachedByText = textKeyed(decomposeSmartArt(element.smartArtData, bounds) ?? []);
	const interpretedByText = textKeyed(
		computeSmartArtElementsWithoutCache(element.smartArtData, bounds) ?? [],
	);
	const boundW = Math.max(1, element.width);
	const boundH = Math.max(1, element.height);
	let matched = 0;
	let maxDeltaFraction = 0;
	for (const [text, cached] of cachedByText) {
		const interpreted = interpretedByText.get(text);
		if (!interpreted) {
			continue;
		}
		matched++;
		maxDeltaFraction = Math.max(
			maxDeltaFraction,
			Math.abs(cached.x - interpreted.x) / boundW,
			Math.abs(cached.y - interpreted.y) / boundH,
			Math.abs(cached.width - interpreted.width) / boundW,
			Math.abs(cached.height - interpreted.height) / boundH,
		);
	}
	return {
		matched,
		cachedTotal: cachedByText.size,
		interpretedTotal: interpretedByText.size,
		maxDeltaFraction: Math.round(maxDeltaFraction * 10000) / 10000,
	};
}

async function main(): Promise<void> {
	const manifest = JSON.parse(
		readFileSync(path.join(GALLERY_DIR, 'manifest.json'), 'utf-8'),
	) as ManifestEntry[];
	const onDisk = new Set(readdirSync(GALLERY_DIR).filter((f) => f.endsWith('.pptx')));
	const baseline: Record<string, BaselineEntry> = {};
	for (const entry of manifest) {
		if (!onDisk.has(entry.file)) {
			continue;
		}
		baseline[entry.file] = await evaluate(entry.file);
	}
	const sorted: Record<string, BaselineEntry> = {};
	for (const key of Object.keys(baseline).sort()) {
		sorted[key] = baseline[key];
	}
	writeFileSync(path.join(GALLERY_DIR, 'baseline.json'), `${JSON.stringify(sorted, null, 2)}\n`);
	console.log(`Wrote baseline for ${Object.keys(sorted).length} fixtures.`);
}

main().catch((err: unknown) => {
	console.error(err);
	process.exitCode = 1;
});
