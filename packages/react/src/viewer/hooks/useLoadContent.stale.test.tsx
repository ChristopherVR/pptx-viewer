// @vitest-environment happy-dom
import { PptxHandler } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	editPresentation,
	holdPresentationAsset,
	presentationLoadFixtures,
	settlePresentationLoad,
} from '../../../../shared/test-utils/presentation-load.mjs';
import type { EditorHistoryResult } from './useEditorHistory';
import { useLoadContent } from './useLoadContent';
import { useViewerState } from './useViewerState';

afterEach(() => vi.restoreAllMocks());

describe('presentation load cancellation after parsing', () => {
	it.each([
		['replace', 'image'],
		['unmount', 'image'],
		['replace', 'media'],
		['unmount', 'media'],
	] as const)(
		'discards delayed assets on %s (%s)',
		async (action, asset) => {
			const fixtures = await presentationLoadFixtures(PptxHandler, asset);
			const held = holdPresentationAsset(PptxHandler, asset);
			const resetHistory = vi.fn();
			const applied = vi.fn();
			let state!: ReturnType<typeof useViewerState>;
			let loaded!: ReturnType<typeof useLoadContent>;
			function Harness({ content }: { content: Uint8Array }) {
				state = useViewerState({ content, canEdit: true });
				loaded = useLoadContent({
					...state,
					content,
					clearSelection: vi.fn(),
					history: { resetHistory } as unknown as EditorHistoryResult,
					setIsEncrypted: vi.fn(),
					setReadOnlyRecommendation: vi.fn(),
					setModifyVerifier: vi.fn(),
					setCompatToasts: vi.fn(),
					onContentApplied: applied,
				});
				return null;
			}
			const host = document.createElement('div');
			const root = createRoot(host);
			let unmounted = false;
			try {
				await act(async () => {
					root.render(<Harness content={fixtures.first} />);
				});
				await held.entered;
				if (action === 'unmount') {
					await act(async () => root.unmount());
					unmounted = true;
				} else {
					await act(async () => {
						root.render(<Harness content={fixtures.second} />);
					});
					await vi.waitFor(async () => {
						await act(settlePresentationLoad);
						expect(state.coreProperties?.title).toBe('Presentation B');
					});
					await act(async () => {
						state.setSlides(editPresentation(state.slides));
						state.setIsDirty(true);
					});
				}
				const currentMedia = [...state.mediaDataUrls];
				const currentHandler = loaded.handlerRef.current;
				await act(async () => {
					held.release();
					await settlePresentationLoad();
				});
				if (action === 'replace') {
					expect([...state.mediaDataUrls]).toStrictEqual(currentMedia);
					expect(state.coreProperties?.title).toBe('Presentation B');
					expect(state.slides[0].notes).toBe('Unsaved edit in B');
					expect(state.isDirty).toBeTruthy();
					expect(loaded.handlerRef.current).toBe(currentHandler);
				}
				expect(applied).toHaveBeenCalledTimes(action === 'replace' ? 1 : 0);
				expect(resetHistory).toHaveBeenCalledTimes(action === 'replace' ? 1 : 0);
				expect(held.disposal).toHaveBeenCalledOnce();
			} finally {
				held.release();
				if (!unmounted) {
					await act(async () => root.unmount());
				}
				host.remove();
			}
		},
		30_000,
	);
});
