/**
 * slide-size-save.test.ts: Design > Slide Size has to change the bytes, and a
 * deck authored to open into a custom show has to actually open into it.
 *
 * Both were dead ends before this. The inspector's SLIDE SIZE card wrote a
 * PIXEL canvas size that no save option carried, so core re-emitted the
 * load-time `p:sldSz` verbatim and every preset pick was lost on save. And
 * `p:showPr/p:custShow/@id` was parsed into `showSlidesCustomShowId` and then
 * ignored: playback ran off a viewer-only `activeCustomShowId` that nothing
 * ever seeded.
 *
 * These assert the PACKAGE and the STORE, not spies: a spy on `handler.save`
 * would have been satisfied by an option core ignored.
 */
import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import { SLIDE_SIZE_PRESETS, slideSizeFromPreset } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createLoadingController } from '../loading-controller';
import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import { createDeckActions } from './editor-deck-actions';
import { createEditorOps } from './editor-operations';

/** Ledger: 12179300 x 9134475 EMU, the preset a pixel round-trip destroys. */
const LEDGER = SLIDE_SIZE_PRESETS.find((preset) => preset.labelKey === 'ledger')!;

interface DeckOptions {
	/** Author `p:custShowLst` + `p:showPr/p:custShow`, as PowerPoint would. */
	readonly authorCustomShow?: boolean;
}

/** A three-slide deck, optionally opening into a named custom show. */
async function buildDeck(options: DeckOptions = {}): Promise<ArrayBuffer> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 3 });
	try {
		const bytes = await handler.save(
			data.slides,
			options.authorCustomShow
				? {
						customShows: [
							{ id: '0', name: 'Short Show', slideRIds: [data.slides[2].rId] },
							{ id: '1', name: 'Reverse', slideRIds: [data.slides[1].rId] },
						],
						presentationProperties: {
							showSlidesMode: 'customShow',
							showSlidesCustomShowId: '0',
						},
					}
				: undefined,
		);
		return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
	} finally {
		handler.dispose();
	}
}

interface LoadedViewer {
	store: Store<ViewerState>;
	deck: ReturnType<typeof createDeckActions>;
	save: () => Promise<Uint8Array>;
	dispose: () => void;
}

/** Load `buffer` through the real loading controller into a real store. */
async function loadViewer(buffer: ArrayBuffer): Promise<LoadedViewer> {
	const store = createStore({ ...createInitialViewerState(), editable: true });
	const loading = createLoadingController({
		options: {},
		store,
		getTranslator: () => createTranslator(),
		getEditor: () => undefined,
	});
	await loading.load(buffer);
	const ops = createEditorOps({
		store,
		getHandler: () => loading.getHandler(),
		onHistoryChange: vi.fn(),
	});
	const deck = createDeckActions({ store, ops, getHandler: () => loading.getHandler() });
	return { store, deck, save: () => ops.save('pptx'), dispose: () => loading.releaseLoaded() };
}

/** `p:sldSz` as written into the saved package. */
async function savedSlideSize(bytes: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const presentation = await zip.file('ppt/presentation.xml')!.async('string');
	return /<p:sldSz[^>]*>/.exec(presentation)?.[0] ?? '';
}

describe('vanilla slide size', () => {
	it('seeds the EMU size from the load and writes a picked preset into p:sldSz', async () => {
		const viewer = await loadViewer(await buildDeck());
		try {
			// Seeded from `p:sldSz`, not from the pixel canvas.
			expect(viewer.store.get().slideSize?.widthEmu).toBeGreaterThan(0);

			viewer.deck.updateSlideSize(slideSizeFromPreset(LEDGER, 'landscape'));

			// The EMU state AND the pixel canvas both move, so the stage resizes.
			expect(viewer.store.get().slideSize).toStrictEqual({
				widthEmu: LEDGER.widthEmu,
				heightEmu: LEDGER.heightEmu,
				type: 'ledger',
			});
			expect(viewer.store.get().canvasSize).toStrictEqual({ width: 1279, height: 959 });

			const written = await savedSlideSize(await viewer.save());
			// Exact EMU, not the 1279px round-trip (which would be 12182475 EMU and
			// would cost the deck its ppSlideSizeLedgerPaper identity).
			expect(written).toContain(`cx="${String(LEDGER.widthEmu)}"`);
			expect(written).toContain(`cy="${String(LEDGER.heightEmu)}"`);
			expect(written).toContain('type="ledger"');
		} finally {
			viewer.dispose();
		}
	}, 60_000);

	it('lets the raw W/H pixel inputs win over a stale EMU size', async () => {
		const viewer = await loadViewer(await buildDeck());
		try {
			viewer.deck.updateSlideSize(slideSizeFromPreset(LEDGER, 'landscape'));
			// Typing into the W/H fields disagrees with the EMU size, so the pixels
			// are what the user meant.
			viewer.deck.updateCanvasSize({ width: 800, height: 600 });

			const written = await savedSlideSize(await viewer.save());
			expect(written).toContain(`cx="${String(800 * 9525)}"`);
			expect(written).toContain(`cy="${String(600 * 9525)}"`);
		} finally {
			viewer.dispose();
		}
	}, 60_000);

	it('rotates a preset to portrait without losing its type', async () => {
		const viewer = await loadViewer(await buildDeck());
		try {
			viewer.deck.updateSlideSize(slideSizeFromPreset(LEDGER, 'portrait'));

			const written = await savedSlideSize(await viewer.save());
			expect(written).toContain(`cx="${String(LEDGER.heightEmu)}"`);
			expect(written).toContain(`cy="${String(LEDGER.widthEmu)}"`);
			expect(written).toContain('type="ledger"');
		} finally {
			viewer.dispose();
		}
	}, 60_000);
});

describe('vanilla authored custom show', () => {
	it('seeds activeCustomShowId from p:showPr/p:custShow on load', async () => {
		const viewer = await loadViewer(await buildDeck({ authorCustomShow: true }));
		try {
			// Guard the fixture: without these the seeding would agree for the
			// wrong reason.
			expect(viewer.store.get().customShows.map((show) => show.id)).toStrictEqual(['0', '1']);
			expect(viewer.store.get().presentationProperties.showSlidesCustomShowId).toBe('0');

			expect(viewer.store.get().activeCustomShowId).toBe('0');
		} finally {
			viewer.dispose();
		}
	}, 60_000);

	it('leaves activeCustomShowId null for a deck that names no show', async () => {
		const viewer = await loadViewer(await buildDeck());
		try {
			expect(viewer.store.get().activeCustomShowId).toBeNull();
		} finally {
			viewer.dispose();
		}
	}, 60_000);
});
