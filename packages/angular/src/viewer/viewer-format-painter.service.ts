/**
 * viewer-format-painter.service.ts: Viewer-scoped state + logic for the format
 * painter (copy one element's shape/text style onto the next clicked element)
 * and the eyedropper (sample a screen colour onto the selected shape's fill,
 * else copy it to the clipboard). Both are "apply a style to an element"
 * interactions keyed off the current selection.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds the
 * selection / active-slide accessors via {@link bind}; the template reads the
 * armed/active flags and invokes the toggles, and the component's selection and
 * keyboard handlers consult {@link active} / call {@link applyToTarget} /
 * {@link cancel}.
 *
 * Provide it once on the viewer component (`providers: [ViewerFormatPainterService]`).
 */

import { computed, inject, Injectable, signal } from '@angular/core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { eyedropperAvailable, openNativeEyeDropper, pickColorByClickFallback } from './eyedropper';
import { applyFormatToElement, copyFormatFromElement, hasCopyableFormat } from './format-painter';
import type { CopiedFormat } from './format-painter';

/** Live selection/slide accessors the painter needs from the host component. */
interface FormatPainterHost {
	readonly selectedElement: () => PptxElement | null;
	readonly activeSlideIndex: () => number;
	readonly findActiveElement: (id: string) => PptxElement | undefined;
}

@Injectable()
export class ViewerFormatPainterService {
	private readonly editor = inject(EditorStateService);

	/** True while the painter is armed (next element click applies the copied format). */
	readonly active = signal(false);
	/** Whether the eyedropper is currently active. */
	readonly eyedropperActive = signal(false);
	/** Format copied from the source element when the painter was armed. */
	private copiedFormat: CopiedFormat | null = null;

	private host: FormatPainterHost | null = null;

	/** Wire the host selection/slide accessors (called once from the constructor). */
	bind(host: FormatPainterHost): void {
		this.host = host;
	}

	private requireHost(): FormatPainterHost {
		if (!this.host) {
			throw new Error('ViewerFormatPainterService.bind() was not called');
		}
		return this.host;
	}

	/** Whether the painter can be armed: exactly one selected element with copyable format. */
	readonly canActivate = computed(() => hasCopyableFormat(this.host?.selectedElement() ?? null));

	/** Toggle the format painter: arm from the current selection, or disarm. */
	toggle(): void {
		if (this.active()) {
			this.cancel();
			return;
		}
		const source = this.requireHost().selectedElement();
		if (!source || !hasCopyableFormat(source)) {
			return;
		}
		this.copiedFormat = copyFormatFromElement(source);
		this.active.set(true);
	}

	/** Disarm the painter and drop the copied format. */
	cancel(): void {
		this.active.set(false);
		this.copiedFormat = null;
	}

	/** Apply the copied format to a target element (shape/text style only; one history entry). */
	applyToTarget(id: string): void {
		const format = this.copiedFormat;
		const host = this.requireHost();
		const target = host.findActiveElement(id);
		if (!format || !target) {
			return;
		}
		const updated = applyFormatToElement(target, format) as unknown as Record<string, unknown>;
		const patch: Record<string, unknown> = {};
		if (format.shapeStyle && updated['shapeStyle'] !== undefined) {
			patch['shapeStyle'] = updated['shapeStyle'];
		}
		if (format.textStyle && updated['textStyle'] !== undefined) {
			patch['textStyle'] = updated['textStyle'];
		}
		if (Object.keys(patch).length > 0) {
			this.editor.updateElement(host.activeSlideIndex(), id, patch as Partial<PptxElement>);
		}
	}

	/**
	 * Activate the eyedropper to pick a colour from the screen. Uses the native
	 * EyeDropper API where available (Chrome/Edge); on Firefox/Safari it falls
	 * back to a one-shot click that samples the slide DOM under the pointer.
	 * When a shape/text/connector/image element is selected, applies the colour
	 * to its fill; otherwise copies it to the clipboard. No-ops when the user
	 * cancels (Escape) or nothing paintable is under the pointer.
	 */
	async toggleEyedropper(): Promise<void> {
		this.eyedropperActive.set(true);
		try {
			const color = eyedropperAvailable()
				? await openNativeEyeDropper()
				: await pickColorByClickFallback();
			if (color) {
				await this.applyEyedropperColor(color);
			}
		} finally {
			this.eyedropperActive.set(false);
		}
	}

	/** Apply a picked colour to the selected shape's fill, else copy to clipboard. */
	private async applyEyedropperColor(color: string): Promise<void> {
		const host = this.requireHost();
		const sel = host.selectedElement();
		const idx = host.activeSlideIndex();
		if (sel !== null && hasShapeProperties(sel)) {
			this.editor.updateElement(idx, sel.id, {
				shapeStyle: { ...sel.shapeStyle, fillColor: color },
			} as Partial<PptxElement>);
		} else {
			await navigator.clipboard.writeText(color).catch(() => undefined);
		}
	}
}
