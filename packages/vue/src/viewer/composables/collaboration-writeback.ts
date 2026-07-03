/**
 * collaboration-writeback.ts: elected-writer (role 'owner') PPTX write-back.
 *
 * Only the session owner persists snapshots, eliminating last-save-wins races.
 * On a debounced trigger it reloads the retained source bytes, overlays the
 * live Y.Doc slides (merging the separately-stored master/layout template
 * elements back in so template edits survive), re-serializes to PPTX bytes, and
 * hands them to `config.onWriteBack`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { CollaborationConfig, YDocLike } from 'pptx-viewer-shared';
import { readSlidesFromYDoc } from 'pptx-viewer-shared';

import { buildSaveSlides } from './template-editing';

const DEFAULT_DEBOUNCE_MS = 5_000;

export interface WriteBackDeps {
	/** The live Y.Doc, or null when disconnected. */
	getYDoc: () => YDocLike | null;
	/** The retained source PPTX bytes to reload before overlaying Y.Doc slides. */
	getSourceBytes?: () => Uint8Array | null;
	/** The per-slide master/layout template element store to merge back. */
	getTemplateElements?: () => Record<string, PptxElement[]>;
}

export interface WriteBackScheduler {
	/** Debounce a write-back for the given session (no-op unless role 'owner'). */
	schedule: (config: CollaborationConfig) => void;
	/** Cancel any pending write-back. */
	cancel: () => void;
}

export function createWriteBackScheduler(deps: WriteBackDeps): WriteBackScheduler {
	let timer: ReturnType<typeof setTimeout> | null = null;

	function cancel(): void {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function schedule(config: CollaborationConfig): void {
		if (!config.onWriteBack || config.role !== 'owner' || !deps.getYDoc()) {
			return;
		}
		cancel();
		const debounceMs = config.writeBackDebounceMs ?? DEFAULT_DEBOUNCE_MS;
		timer = setTimeout(async () => {
			timer = null;
			const ydoc = deps.getYDoc();
			if (!ydoc || !config.onWriteBack) {
				return;
			}
			const sourceBytes = deps.getSourceBytes?.();
			if (!sourceBytes) {
				return;
			}
			try {
				const { PptxHandler } = await import('pptx-viewer-core');
				const handler = new PptxHandler();
				await handler.load(sourceBytes.buffer as ArrayBuffer);
				const slides = readSlidesFromYDoc(ydoc);
				const merged = buildSaveSlides(slides, deps.getTemplateElements?.() ?? {});
				const bytes = await handler.save(merged);
				config.onWriteBack(bytes);
			} catch {
				/* non-fatal */
			}
		}, debounceMs);
	}

	return { schedule, cancel };
}
