/**
 * collaboration-writeback.ts: elected-writer (role 'owner') PPTX write-back.
 *
 * Ported from the Vue binding, minus the master/layout template-element merge
 * (the Svelte viewer does not expose template editing). Only the session owner
 * persists snapshots, eliminating last-save-wins races: on a debounced trigger
 * it reloads the retained source bytes, overlays the live Y.Doc slides,
 * re-serializes to PPTX bytes, and hands them to `config.onWriteBack`.
 */
import type { CollaborationConfig, YDocLike } from 'pptx-viewer-shared';
import { readSlidesFromYDoc } from 'pptx-viewer-shared';

const DEFAULT_DEBOUNCE_MS = 5_000;

export interface WriteBackDeps {
	/** The live Y.Doc, or null when disconnected. */
	getYDoc: () => YDocLike | null;
	/** The retained source PPTX bytes to reload before overlaying Y.Doc slides. */
	getSourceBytes?: () => Uint8Array | null;
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
				const bytes = await handler.save(slides);
				config.onWriteBack(bytes);
			} catch {
				/* non-fatal */
			}
		}, debounceMs);
	}

	return { schedule, cancel };
}
