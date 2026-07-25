/**
 * collaboration-writeback.ts: elected-writer serialization helper for the
 * Angular collaboration service.
 *
 * When the local user is the session `owner`, the service debounces Y.Doc
 * changes and calls this to serialize the live document (templates re-merged)
 * into `.pptx` bytes for `config.onWriteBack`. Kept out of the service so the
 * service stays within the repo's per-file size budget.
 */

import { PptxHandler } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';

import { readSlidesFromYDoc } from '../internal/shared';
import type { CollaborationConfig, YDocLike } from '../internal/shared';
import { buildSaveSlides } from './template-mode';
import type { TemplateElementsBySlideId } from './template-mode';

const WRITE_BACK_DEBOUNCE_MS = 5_000;

/**
 * Serialize the current Y.Doc slide state (with the separated master/layout
 * template elements merged back) into `.pptx` bytes. `sourceBytes` seeds the
 * handler so package parts the CRDT does not carry (media, fonts, rels) survive.
 */
export async function serializeWriteBack(
	ydoc: YDocLike,
	sourceBytes: Uint8Array,
	templateElements: TemplateElementsBySlideId,
): Promise<Uint8Array> {
	const handler = new PptxHandler();
	await handler.load(sourceBytes.buffer as ArrayBuffer);
	const slides = buildSaveSlides(readSlidesFromYDoc(ydoc) as PptxSlide[], templateElements);
	return handler.save(slides);
}

/**
 * Debounced elected-writer write-back. Only the session `owner` with an
 * `onWriteBack` callback schedules anything; each new change resets the timer,
 * and on fire it serializes the live Y.Doc and hands the bytes to the host.
 */
export class WriteBackScheduler {
	private timer: ReturnType<typeof setTimeout> | null = null;

	schedule(
		config: CollaborationConfig | null,
		ydoc: YDocLike | null,
		getSourceBytes: (() => Uint8Array | null) | null,
		getTemplateElements: (() => TemplateElementsBySlideId) | null,
	): void {
		if (!config?.onWriteBack || config.role !== 'owner' || !ydoc) {
			return;
		}
		this.cancel();
		const ms = config.writeBackDebounceMs ?? WRITE_BACK_DEBOUNCE_MS;
		this.timer = setTimeout(() => {
			this.timer = null;
			const bytes = getSourceBytes?.();
			if (!bytes || !config.onWriteBack) {
				return;
			}
			void serializeWriteBack(ydoc, bytes, getTemplateElements?.() ?? {})
				.then((out) => config.onWriteBack?.(out))
				.catch(() => {
					/* non-fatal */
				});
		}, ms);
	}

	cancel(): void {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}
}
