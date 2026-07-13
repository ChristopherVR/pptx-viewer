import { applyFormatToElement, copyFormatFromElement, hasCopyableFormat } from 'pptx-viewer-shared';
import type { CopiedFormat } from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

/** One-shot Format Painter state and history-integrated application. */
export class EditorFormatPainterController {
	#format = $state.raw<CopiedFormat | null>(null);

	constructor(private readonly editor: EditorState) {}

	get active(): boolean {
		return this.#format !== null;
	}

	get enabled(): boolean {
		return this.editor.editable && hasCopyableFormat(this.editor.selectedElement);
	}

	toggle(): void {
		if (this.active) {
			this.cancel();
			return;
		}
		const source = this.editor.selectedElement;
		if (this.editor.editable && source && hasCopyableFormat(source)) {
			this.#format = copyFormatFromElement(source);
		}
	}

	applyTo(id: string): boolean {
		if (!this.#format) {
			return false;
		}
		const elements = this.editor.activeElements;
		if (!elements.some((element) => element.id === id)) {
			return false;
		}
		this.editor.commitActiveElements(
			elements.map((element) =>
				element.id === id ? applyFormatToElement(element, this.#format ?? {}) : element,
			),
		);
		this.editor.selection.set(id);
		this.cancel();
		return true;
	}

	cancel(): void {
		this.#format = null;
	}
}
