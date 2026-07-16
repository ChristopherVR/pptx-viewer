import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import { createDefaultRegistry, renderSlideStage } from '../render';
import { loadPresentation } from './load-presentation';
import { resolveSourceToBuffer } from './source';

const FIXTURE = resolve(__dirname, '../../../../../e2e/fixtures/sample-deck.pptx');

function readFixture(): ArrayBuffer {
	const bytes = readFileSync(FIXTURE);
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

describe('loadPresentation (real .pptx happy path)', () => {
	it('parses a real deck and renders its first slide through the registry', async () => {
		const loaded = await loadPresentation(readFixture());
		try {
			expect(loaded.slides.length).toBeGreaterThan(0);
			expect(loaded.canvasSize.width).toBeGreaterThan(0);
			expect(loaded.canvasSize.height).toBeGreaterThan(0);
			expect(Array.isArray(loaded.embeddedFonts)).toBeTruthy();
			expect(loaded.digitalSignatureCount).toBeGreaterThanOrEqual(0);

			const stage = renderSlideStage({
				document,
				slide: loaded.slides[0],
				canvasSize: loaded.canvasSize,
				mediaDataUrls: loaded.mediaDataUrls,
				registry: createDefaultRegistry(),
				t: createTranslator(),
				scale: 0.5,
			});
			expect(stage.querySelectorAll('[data-element-id]').length).toBeGreaterThan(0);
		} finally {
			loaded.handler.dispose();
		}
	});

	it('rejects on invalid bytes without leaking the handler', async () => {
		await expect(loadPresentation(new ArrayBuffer(8))).rejects.toThrow();
	});
});

describe('resolveSourceToBuffer', () => {
	it('normalises Uint8Array views to their exact byte range', async () => {
		const backing = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
		const view = new Uint8Array(backing.buffer, 2, 3);
		const buffer = await resolveSourceToBuffer(view);
		expect(Array.from(new Uint8Array(buffer))).toStrictEqual([2, 3, 4]);
	});

	it('passes ArrayBuffers through and reads Blobs', async () => {
		const raw = new Uint8Array([9, 8, 7]).buffer;
		await expect(resolveSourceToBuffer(raw)).resolves.toBe(raw);

		const blob = new Blob([new Uint8Array([1, 2])]);
		const fromBlob = await resolveSourceToBuffer(blob);
		expect(new Uint8Array(fromBlob)).toHaveLength(2);
	});
});
