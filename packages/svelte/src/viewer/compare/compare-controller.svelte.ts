import { PptxHandler } from 'pptx-viewer-core';
import type { CompareResult } from 'pptx-viewer-shared';
import { applyAcceptAllSlides, applyAcceptSlide, compareSlides } from 'pptx-viewer-shared';

import type { EditorState } from '../editor/editor-state.svelte';

export class CompareController {
	result = $state.raw<CompareResult | null>(null);
	open = $state(false);
	accepted = $state.raw<Set<number>>(new Set());
	rejected = $state.raw<Set<number>>(new Set());
	readonly #editor: EditorState;

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	async chooseFile(): Promise<void> {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.pptx,.pptm,.ppsx';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) {
				return;
			}
			const handler = new PptxHandler();
			try {
				const incoming = await handler.load(await file.arrayBuffer());
				this.result = compareSlides(this.#editor.renderedSlides, incoming.slides);
				this.accepted = new Set();
				this.rejected = new Set();
				this.open = true;
			} finally {
				handler.dispose();
			}
		};
		input.click();
	}

	accept(index: number): void {
		const diff = this.result?.diffs[index];
		if (!diff || diff.status === 'unchanged') {
			return;
		}
		this.#editor.commitSlides(applyAcceptSlide(this.#editor.slides, diff));
		this.accepted = new Set([...this.accepted, index]);
		const rejected = new Set(this.rejected);
		rejected.delete(index);
		this.rejected = rejected;
	}

	reject(index: number): void {
		this.rejected = new Set([...this.rejected, index]);
		const accepted = new Set(this.accepted);
		accepted.delete(index);
		this.accepted = accepted;
	}

	acceptAll(): void {
		if (!this.result) {
			return;
		}
		this.#editor.commitSlides(applyAcceptAllSlides(this.#editor.slides, this.result));
		this.accepted = new Set(
			this.result.diffs
				.map((diff, index) => (diff.status === 'unchanged' ? -1 : index))
				.filter((index) => index >= 0),
		);
		this.rejected = new Set();
	}
}
