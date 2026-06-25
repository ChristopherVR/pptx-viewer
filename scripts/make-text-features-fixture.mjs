/**
 * Generates e2e/fixtures/text-features.pptx by loading sample-deck.pptx and
 * adding text elements that exercise the renderer features wired into the
 * bindings: vertical text, a double-underline run, distributed alignment, and a
 * slide-number field. Used for cross-binding visual parity checks.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from 'pptx-viewer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDeck = resolve(root, 'e2e/fixtures/sample-deck.pptx');

const bytes = new Uint8Array(await readFile(srcDeck));
const handler = new PptxHandler();
const data = await handler.load(bytes.buffer);
const slide = data.slides[0];

const base = slide.elements.find((e) => e.type === 'text');
if (!base) {
	throw new Error('no text element to clone');
}

function makeFeatureElement(id, x, y, w, h, segments, extraStyle) {
	const el = structuredClone(base);
	el.id = id;
	el.x = x;
	el.y = y;
	el.width = w;
	el.height = h;
	el.text = segments.map((s) => s.text).join('');
	el.textSegments = segments.map((s) => ({ ...s }));
	// Drop captured raw XML so the save writer serializes from the typed fields
	// (otherwise the cloned rawXml re-emits the original run/paragraph props and
	// the injected textDirection/underline/align are ignored on round-trip).
	delete el.rawXml;
	delete el.extLstXml;
	el.textStyle = { ...(el.textStyle ?? {}), ...(extraStyle ?? {}) };
	return el;
}

// Element positions are stored in PIXELS (slide is ~960x720). Place the feature
// elements over the white right half so they are clearly visible.
const vertical = makeFeatureElement(
	'feat-vertical',
	500,
	30,
	60,
	200,
	[{ text: 'Vertical text', style: { fontSize: 22, color: '#1a73e8', textDirection: 'vertical' } }],
	{ textDirection: 'vertical' },
);

const underline = makeFeatureElement('feat-underline', 580, 40, 360, 44, [
	{
		text: 'Double underline',
		style: { fontSize: 26, color: '#202124', underline: true, underlineStyle: 'dbl' },
	},
]);

const wavy = makeFeatureElement('feat-wavy', 580, 100, 360, 44, [
	{
		text: 'Wavy underline',
		style: { fontSize: 26, color: '#202124', underline: true, underlineStyle: 'wavy' },
	},
]);

const dist = makeFeatureElement(
	'feat-dist',
	580,
	620,
	380,
	80,
	[
		{
			text: 'This paragraph uses distributed alignment so the words spread edge to edge',
			style: { fontSize: 16, color: '#202124', align: 'dist' },
		},
	],
	{ align: 'dist' },
);

const field = makeFeatureElement('feat-field', 820, 540, 120, 30, [
	{ text: 'Slide ', style: { fontSize: 16, color: '#5f6368' } },
	{ text: '1', style: { fontSize: 16, color: '#5f6368' }, fieldType: 'slidenum' },
]);

slide.elements.push(vertical, underline, wavy, dist, field);

const out = await handler.save(data.slides);
const outPath = resolve(root, 'e2e/fixtures/text-features.pptx');
await writeFile(outPath, out);
console.log('wrote', outPath, out.byteLength, 'bytes; elements on slide 1:', slide.elements.length);
