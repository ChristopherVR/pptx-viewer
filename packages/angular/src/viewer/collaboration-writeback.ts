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
import type { PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';

import { createWriteBackScheduler, readSlidesFromYDoc } from '../internal/shared';
import type { CollaborationConfig, YDocLike } from '../internal/shared';
import { buildSaveSlides } from './template-mode';
import type { TemplateElementsBySlideId } from './template-mode';

/**
 * Serialize the current Y.Doc slide state (with the separated master/layout
 * template elements merged back) into `.pptx` bytes. `sourceBytes` seeds the
 * handler so package parts the CRDT does not carry (media, fonts, rels) survive.
 *
 * `saveOptions` carries the session-level save options (view properties,
 * table styles, tags, deck properties, ...) built the same way as the
 * Save/Export path (`buildDeckSaveOptions`). Without it the write-back
 * dropped every session-level edit outside `slides`.
 */
export async function serializeWriteBack(
	ydoc: YDocLike,
	sourceBytes: Uint8Array,
	templateElements: TemplateElementsBySlideId,
	saveOptions?: PptxHandlerSaveOptions,
	isCurrent: () => boolean = () => true,
): Promise<Uint8Array> {
	const handler = new PptxHandler();
	await handler.load(sourceBytes.buffer as ArrayBuffer);
	if (!isCurrent()) {
		throw new Error('Collaboration session changed during serialization');
	}
	const slides = buildSaveSlides(readSlidesFromYDoc(ydoc) as PptxSlide[], templateElements);
	return handler.save(slides, saveOptions);
}

/**
 * Debounced elected-writer write-back. Only the session `owner` with an
 * `onWriteBack` callback schedules anything; each new change resets the timer,
 * and on fire it serializes the live Y.Doc and hands the bytes to the host.
 */
export class WriteBackScheduler {
	private ydoc: YDocLike | null = null;
	private serialize: ((isCurrent: () => boolean) => Promise<Uint8Array | null>) | null = null;
	private readonly scheduler = createWriteBackScheduler({
		getYDoc: () => this.ydoc,
		serialize: (isCurrent) => this.serialize?.(isCurrent) ?? null,
	});

	schedule(
		config: CollaborationConfig | null,
		ydoc: YDocLike | null,
		getSourceBytes: (() => Uint8Array | null) | null,
		getTemplateElements: (() => TemplateElementsBySlideId) | null,
		getSaveOptions?: (() => PptxHandlerSaveOptions) | null,
	): void {
		if (!config?.onWriteBack || config.role !== 'owner' || !ydoc) {
			return;
		}
		this.cancel();
		this.ydoc = ydoc;
		this.serialize = async (isCurrent) => {
			const bytes = getSourceBytes?.();
			if (!bytes) {
				return null;
			}
			return serializeWriteBack(
				ydoc,
				bytes,
				getTemplateElements?.() ?? {},
				getSaveOptions?.(),
				isCurrent,
			);
		};
		this.scheduler.schedule(config);
	}

	cancel(): void {
		this.scheduler.cancel();
		this.serialize = null;
		this.ydoc = null;
	}
}
