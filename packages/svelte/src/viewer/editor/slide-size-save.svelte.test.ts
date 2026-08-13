/**
 * slide-size-save.svelte.test.ts: Design > Slide Size has to change the bytes.
 *
 * The inspector's SLIDE SIZE card wrote a PIXEL canvas size that no save option
 * carried, so core re-emitted the load-time `p:sldSz` verbatim and every preset
 * pick was lost the moment the deck was written. `saveEditorDocument` now
 * forwards the resolved EMU size to core's `slideSize` option, which is the
 * only way an edit can reach `p:sldSz` at all.
 *
 * This asserts the PACKAGE, not a spy: a spy on `handler.save` would have been
 * satisfied by an option core ignored.
 */
import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import { resolveSlideSizeSelection, SLIDE_SIZE_PRESETS } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import type { EditorSnapshot } from './editor-document-state';
import { saveEditorDocument } from './editor-document-state';

/** Ledger: 12179300 x 9134475 EMU, the preset a pixel round-trip destroys. */
const LEDGER = SLIDE_SIZE_PRESETS.find((preset) => preset.labelKey === 'ledger')!;

function emptySnapshot(slides: PptxSlide[]): EditorSnapshot {
	return {
		slides,
		templateElementsBySlideId: {},
		slideMasters: [],
		notesMaster: undefined,
		handoutMaster: undefined,
		sections: [],
		headerFooter: {},
		presentationProperties: {},
		customShows: [],
		coreProperties: undefined,
		appProperties: undefined,
		customProperties: [],
		tagCollections: [],
	};
}

/** `p:sldSz` as written into the saved package. */
async function savedSlideSize(bytes: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const presentation = await zip.file('ppt/presentation.xml')!.async('string');
	return /<p:sldSz[^>]*>/.exec(presentation)?.[0] ?? '';
}

describe('saveEditorDocument slide size', () => {
	it('writes a picked preset into p:sldSz and leaves it alone without one', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		try {
			const snapshot = emptySnapshot(data.slides);

			// No slide size supplied: core re-emits the load-time dimensions, which
			// is exactly the behaviour that made the inspector card decorative.
			const untouched = await savedSlideSize(
				await saveEditorDocument(handler, snapshot, 'pptx', undefined, true),
			);
			expect(untouched).not.toContain('type="ledger"');

			// What the SLIDE SIZE card produces for a Ledger pick: the EMU state
			// agrees with the pixel canvas, so the EMU pair wins verbatim.
			const selection = resolveSlideSizeSelection({
				current: { widthEmu: LEDGER.widthEmu, heightEmu: LEDGER.heightEmu, type: LEDGER.type },
				canvas: { width: 1279, height: 959 },
			});
			const written = await savedSlideSize(
				await saveEditorDocument(handler, snapshot, 'pptx', undefined, true, selection.size),
			);
			// Exact EMU, not the 1279px round-trip (which would be 12182475 EMU and
			// would cost the deck its ppSlideSizeLedgerPaper identity).
			expect(written).toContain(`cx="${String(LEDGER.widthEmu)}"`);
			expect(written).toContain(`cy="${String(LEDGER.heightEmu)}"`);
			expect(written).toContain('type="ledger"');
		} finally {
			handler.dispose();
		}
	}, 30_000);

	it('lets a hand-typed pixel canvas win over a stale EMU size', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		try {
			// Ledger in EMU but 800x600 in pixels: the two disagree, so the user
			// typed into the raw W/H inputs and the pixels are what they meant.
			const selection = resolveSlideSizeSelection({
				current: { widthEmu: LEDGER.widthEmu, heightEmu: LEDGER.heightEmu, type: LEDGER.type },
				canvas: { width: 800, height: 600 },
			});
			const written = await savedSlideSize(
				await saveEditorDocument(
					handler,
					emptySnapshot(data.slides),
					'pptx',
					undefined,
					true,
					selection.size,
				),
			);
			expect(written).toContain(`cx="${String(800 * 9525)}"`);
			expect(written).toContain(`cy="${String(600 * 9525)}"`);
			expect(written).not.toContain('type="ledger"');
		} finally {
			handler.dispose();
		}
	}, 30_000);
});
