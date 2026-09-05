/**
 * collaboration-writeback.ts: elected-writer (role 'owner') PPTX write-back
 * for the vanilla viewer.
 *
 * Unlike the shared `createWriteBackScheduler` (which reloads a fresh
 * `PptxHandler` from retained source bytes), the vanilla viewer already keeps
 * a live, already-loaded `PptxHandler` instance for the session, so this
 * re-serializes directly through it instead of reloading from scratch.
 */
import type { PptxHandler, PptxHandlerSaveOptions } from 'pptx-viewer-core';
import type { CollaborationConfig, YDocLike } from 'pptx-viewer-shared';
import { readSlidesFromYDoc } from 'pptx-viewer-shared';

const DEFAULT_DEBOUNCE_MS = 5_000;

export interface WriteBackDeps {
	getYDoc: () => YDocLike | null;
	getHandler: () => PptxHandler | null;
	/**
	 * Session-level save options (view properties, table styles, tags, deck
	 * properties, ...), built the same way as the Save/Export path
	 * (`buildDeckSaveOptions`). Without this the write-back called
	 * `handler.save(slides)` with NO options, so an owner's write-back file
	 * dropped every session-level edit outside `slides`.
	 */
	getSaveOptions?: () => PptxHandlerSaveOptions;
}

export interface WriteBackScheduler {
	schedule: (config: CollaborationConfig) => void;
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
		if (!config.onWriteBack || config.role !== 'owner') {
			return;
		}
		cancel();
		const debounceMs = config.writeBackDebounceMs ?? DEFAULT_DEBOUNCE_MS;
		timer = setTimeout(() => {
			timer = null;
			const ydoc = deps.getYDoc();
			const handler = deps.getHandler();
			if (!ydoc || !handler || !config.onWriteBack) {
				return;
			}
			void handler
				.save(readSlidesFromYDoc(ydoc), deps.getSaveOptions?.())
				.then((bytes) => config.onWriteBack?.(bytes))
				.catch(() => {
					/* non-fatal: host can retry on the next change */
				});
		}, debounceMs);
	}

	return { schedule, cancel };
}
