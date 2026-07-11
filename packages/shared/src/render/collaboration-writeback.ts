/**
 * collaboration-writeback.ts: elected-writer (role 'owner') PPTX write-back.
 *
 * Only the session owner persists snapshots, eliminating last-save-wins races.
 * On a debounced trigger it reloads the retained source bytes, overlays the
 * live Y.Doc slides (optionally merging back a binding's separately-stored
 * master/layout template elements via `mergeTemplateElements`, so template
 * edits survive), re-serializes to PPTX bytes, and hands them to
 * `config.onWriteBack`.
 *
 * Framework-agnostic: every binding (Vue, Svelte, Vanilla) shares this single
 * implementation instead of maintaining its own near-identical copy. A
 * binding without template-mode editing simply omits `getTemplateElements`/
 * `mergeTemplateElements`. Angular keeps its own class-based
 * `WriteBackScheduler` (a different calling convention tied to its DI style),
 * not a duplicate of this one.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { CollaborationConfig } from '../types';
import type { YDocLike } from './collaboration-sync';
import { readSlidesFromYDoc } from './collaboration-sync';

const DEFAULT_DEBOUNCE_MS = 5_000;

export interface WriteBackDeps {
	/** The live Y.Doc, or null when disconnected. */
	getYDoc: () => YDocLike | null;
	/** The retained source PPTX bytes to reload before overlaying Y.Doc slides. */
	getSourceBytes?: () => Uint8Array | null;
	/** The per-slide master/layout template element store to merge back. */
	getTemplateElements?: () => Record<string, PptxElement[]>;
	/**
	 * Merge template (master/layout) elements back into the broadcast
	 * (template-free) slides before saving. Defaults to a passthrough that
	 * ignores `getTemplateElements` when omitted, for bindings without
	 * template-mode editing.
	 */
	mergeTemplateElements?: (
		slides: PptxSlide[],
		templateElements: Record<string, PptxElement[]>,
	) => PptxSlide[];
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
				const merged = deps.mergeTemplateElements
					? deps.mergeTemplateElements(slides, deps.getTemplateElements?.() ?? {})
					: slides;
				const bytes = await handler.save(merged);
				config.onWriteBack(bytes);
			} catch {
				/* non-fatal */
			}
		}, debounceMs);
	}

	return { schedule, cancel };
}
