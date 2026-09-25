/**
 * Print one gallery fixture's cached shapes next to the per-point engine's,
 * in points relative to the frame (`--tree` adds the engine's layout tree).
 *
 * Usage: `bun scripts/dump-smartart-fixture.ts <fixture-substring> [--tree]`
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from '../packages/core/src/core/PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../packages/core/src/core/types/elements';
import { decomposeSmartArt } from '../packages/core/src/core/utils';
import { runSmartArtEngine } from '../packages/core/src/core/utils/smartart-engine/engine';
import type { EngineNode } from '../packages/core/src/core/utils/smartart-engine/engine-node';
import { runEngineLayout } from '../packages/core/src/core/utils/smartart-engine/engine-to-result';
import { interpretedLayoutToElements } from '../packages/core/src/core/utils/smartart-interpreter-drawing-bridge';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GALLERY_DIR = path.resolve(HERE, '../packages/core/src/__tests__/fixtures/smartart-gallery');
const PT = 0.75;

type ShapeEl = Extract<PptxElement, { type: 'shape' }>;

function shapes(elements: PptxElement[]): ShapeEl[] {
	return elements.filter((el): el is ShapeEl => el.type === 'shape');
}

function textOf(el: ShapeEl): string {
	return (el.text ?? el.textSegments?.map((s) => s.text).join('') ?? '').trim();
}

function row(el: ShapeEl, ox: number, oy: number): string {
	const f = (n: number): string => (n * PT).toFixed(1).padStart(7);
	const font = el.textStyle?.fontSize;
	return `${f(el.x - ox)}${f(el.y - oy)}${f(el.width)}${f(el.height)} ${String(el.shapeType ?? '').padEnd(14)} ${font !== undefined ? (font * PT).toFixed(1) : '-'}pt`;
}

function printTree(node: EngineNode, depth: number): void {
	const b = node.box;
	const box = b
		? `${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.w.toFixed(1)}x${b.h.toFixed(1)}`
		: 'no box';
	const vals = [...node.values].map(([k, v]) => `${k}=${v.toFixed(1)}`).join(' ');
	console.log(
		`${'  '.repeat(depth)}${node.name || '(anon)'} [${node.alg.type}] ${box} ${node.shape?.type ?? ''} {${vals}}`,
	);
	node.children.forEach((c) => printTree(c, depth + 1));
}

async function main(): Promise<void> {
	const needle = process.argv[2];
	const file = readdirSync(GALLERY_DIR).find((f) => f.endsWith('.pptx') && f.includes(needle));
	if (!file) {
		throw new Error(`no fixture matches ${needle}`);
	}
	const buf = readFileSync(path.join(GALLERY_DIR, file));
	const { slides } = await new PptxHandler().load(
		buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
	);
	const element = slides
		.flatMap((s) => s.elements)
		.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
	const data = element?.smartArtData;
	if (!element || !data) {
		throw new Error('no smartart');
	}
	const bounds = { x: element.x, y: element.y, width: element.width, height: element.height };
	console.log(
		`${file} frame ${(bounds.width * PT).toFixed(1)} x ${(bounds.height * PT).toFixed(1)}pt layout ${data.layoutDefinition?.uniqueId}`,
	);
	const cached = shapes(decomposeSmartArt(data, bounds) ?? []);
	const result = runEngineLayout(data, bounds, data.nodes ?? [], ['#4472C4'], data.style ?? 'flat');
	const engine = result
		? shapes(
				interpretedLayoutToElements(
					result,
					data.nodes ?? [],
					bounds,
					data.presLayoutVars?.bulletEnabled,
					data.connections,
				),
			)
		: [];
	console.log('--- cached');
	for (const el of cached) {
		console.log(`${row(el, bounds.x, bounds.y)} ${JSON.stringify(textOf(el).slice(0, 40))}`);
	}
	console.log(`--- engine ${result ? '' : '(declined)'}`);
	for (const el of engine) {
		console.log(`${row(el, bounds.x, bounds.y)} ${JSON.stringify(textOf(el).slice(0, 40))}`);
	}
	if (process.argv.includes('--tree') && data.layoutDefinition?.rawXmlText) {
		const run = runSmartArtEngine(
			data,
			data.layoutDefinition.rawXmlText,
			bounds.width * PT,
			bounds.height * PT,
		);
		if (run) {
			printTree(run.root, 0);
		}
	}
}

main().catch((err: unknown) => {
	console.error(err);
	process.exitCode = 1;
});
