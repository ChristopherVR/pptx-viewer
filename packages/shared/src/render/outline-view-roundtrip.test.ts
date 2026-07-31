/**
 * Outline edits must survive a save and a reload, not just a re-render.
 *
 * The unit tests around `applyOutlineEdit` prove the in-memory deck changed.
 * They cannot prove the change reached OOXML: the outline writes `textSegments`
 * (including `a:pPr/@lvl` on a paragraph's first segment), and a mistake there
 * shows up only once the save writer has serialised it and the loader has
 * parsed it back. This test drives a real `.pptx` through that full circle.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { PptxData, PptxSlide } from 'pptx-viewer-core';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildOutline } from './outline-view';
import { applyOutlineEdit } from './outline-view-edit';

const fixture = fileURLToPath(
	new URL('../../../../e2e/fixtures/sample-deck.pptx', import.meta.url),
);

async function load(bytes: Uint8Array): Promise<{ handler: PptxHandler; slides: PptxSlide[] }> {
	const handler = new PptxHandler();
	const data: PptxData = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
	);
	return { handler, slides: data.slides };
}

describe('outline view round-trip', () => {
	it('an outline edit survives save and reload', async () => {
		// Committed fixture; skip defensively rather than fail a lean checkout.
		if (!existsSync(fixture)) {
			return;
		}
		const { handler, slides } = await load(readFileSync(fixture));

		const rows = buildOutline(slides);
		expect(rows.length).toBeGreaterThan(0);

		const titleRow = rows[0];
		const edited = applyOutlineEdit(slides, {
			type: 'setText',
			key: titleRow.key,
			text: 'Outline edited title',
		});
		expect(edited.changed).toBeTruthy();

		const bodyRow = buildOutline(edited.slides).find((row) => row.kind === 'body');
		const withLevel = bodyRow
			? applyOutlineEdit(edited.slides, { type: 'indent', key: bodyRow.key, delta: 1 })
			: edited;

		const saved = await handler.save(withLevel.slides);
		const after = buildOutline((await load(saved)).slides);

		expect(after[0].text).toBe('Outline edited title');
		if (bodyRow) {
			const sameRow = after.find(
				(row) => row.slideIndex === bodyRow.slideIndex && row.text === bodyRow.text,
			);
			expect(sameRow?.level).toBe(bodyRow.level + 1);
		}
	}, 30_000);
});
