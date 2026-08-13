import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { EditorState } from './editor-state.svelte';

const slide: PptxSlide = { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] };

describe('editor presentation metadata', () => {
	it('accepts a rune-proxy value from a dialog, instead of throwing DataCloneError', () => {
		const editor = new EditorState({
			getCurrent: () => 0,
			getHandler: () => ({ save: async () => new Uint8Array([1]) }) as unknown as PptxHandler,
		});
		editor.editable = true;
		// What the Header & Footer panel actually hands over: its `$state` draft,
		// which is a PROXY. `structuredClone` throws `DataCloneError` on one, so
		// "Apply to All" threw before it ever assigned and setting a footer
		// silently did nothing on the canvas.
		const draft = $state({ hasFooter: true, footerText: 'From The Dialog' });

		expect(() => editor.presentationMetadata.updateHeaderFooter(draft)).not.toThrow();
		expect(editor.headerFooter.footerText).toBe('From The Dialog');
		// Still a real copy: mutating the draft afterwards must not reach the model.
		draft.footerText = 'Changed After Apply';
		expect(editor.headerFooter.footerText).toBe('From The Dialog');
	});

	it('tracks setup, header/footer, and custom-show edits through undo and save', async () => {
		const save = vi.fn(async () => new Uint8Array([1]));
		const editor = new EditorState({
			getCurrent: () => 0,
			getHandler: () => ({ save }) as unknown as PptxHandler,
		});
		editor.editable = true;
		editor.setSlides(
			[slide],
			[],
			undefined,
			undefined,
			[],
			undefined,
			undefined,
			[],
			{ hasFooter: true, footerText: 'Old' },
			{ showType: 'presented' },
			[{ id: '1', name: 'Old show', slideRIds: ['rId1'] }],
		);
		editor.presentationMetadata.updatePresentationProperties({
			showType: 'kiosk',
			loopContinuously: true,
		});
		editor.presentationMetadata.updateHeaderFooter({
			hasFooter: true,
			footerText: 'Confidential',
			hasSlideNumber: true,
		});
		editor.presentationMetadata.updateCustomShows([
			{ id: '2', name: 'Highlights', slideRIds: ['rId1'] },
		]);
		expect(editor.dirty).toBeTruthy();
		expect(editor.customShows[0]?.name).toBe('Highlights');
		editor.undo();
		expect(editor.customShows[0]?.name).toBe('Old show');
		editor.redo();
		await editor.save();
		expect(save.mock.calls[0]?.[1]).toMatchObject({
			presentationProperties: { showType: 'kiosk', loopContinuously: true },
			headerFooter: { footerText: 'Confidential', hasSlideNumber: true },
			customShows: [{ name: 'Highlights' }],
		});
	});
});
