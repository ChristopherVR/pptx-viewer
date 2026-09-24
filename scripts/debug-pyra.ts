import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from '../packages/core/src/core/PptxHandler';
import type { SmartArtPptxElement } from '../packages/core/src/core/types/elements';
import { decomposeSmartArt } from '../packages/core/src/core/utils';
import { runEngineLayout } from '../packages/core/src/core/utils/smartart-engine/engine-to-result';
import { interpretedLayoutToElements } from '../packages/core/src/core/utils/smartart-interpreter-drawing-bridge';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? 'basic-pyramid--hier5.pptx';
const fixturePath = path.resolve(
	HERE,
	'../packages/core/src/__tests__/fixtures/smartart-gallery',
	file,
);

async function main(): Promise<void> {
	const buf = readFileSync(fixturePath);
	const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
	const handler = new PptxHandler();
	const { slides } = await handler.load(ab);
	const element = slides
		.flatMap((s) => s.elements)
		.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
	const data = element?.smartArtData;
	if (!element || !data || !data.layoutDefinition) {
		console.log('no smartart data');
		return;
	}
	const bounds = { x: element.x, y: element.y, width: element.width, height: element.height };
	console.log('=== nodes ===');
	for (const n of data.nodes ?? []) {
		console.log(`${n.id} parent=${n.parentId ?? '-'} "${n.text}"`);
	}
	const cached = decomposeSmartArt(data, bounds) ?? [];
	console.log('=== cached ===');
	for (const el of cached) {
		if (el.type !== 'shape') {
			continue;
		}
		const text = (el.text ?? el.textSegments?.map((s) => s.text).join('') ?? '').trim();
		console.log(
			text.padEnd(20),
			'x=',
			el.x.toFixed(1),
			'y=',
			el.y.toFixed(1),
			'w=',
			el.width.toFixed(1),
			'h=',
			el.height.toFixed(1),
		);
	}

	const palette = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
	const engineResult = runEngineLayout(
		data,
		bounds,
		data.nodes ?? [],
		palette,
		data.style ?? 'flat',
	);
	const engineElements = engineResult
		? interpretedLayoutToElements(
				engineResult,
				data.nodes ?? [],
				bounds,
				data.presLayoutVars?.bulletEnabled,
				data.connections,
			)
		: undefined;
	console.log('=== engine ===');
	for (const el of engineElements ?? []) {
		if (el.type !== 'shape') {
			continue;
		}
		const text = (el.text ?? el.textSegments?.map((s) => s.text).join('') ?? '').trim();
		console.log(
			text.padEnd(20),
			'x=',
			el.x.toFixed(1),
			'y=',
			el.y.toFixed(1),
			'w=',
			el.width.toFixed(1),
			'h=',
			el.height.toFixed(1),
		);
	}
	console.log('bound width', element.width, 'height', element.height);
}

main();
