import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

import type { EditorState } from './editor-state.svelte';

/** Existing-equation edit state with history-integrated OMML replacement. */
export class EditorEquationController {
	editingId = $state<string | null>(null);

	constructor(private readonly editor: EditorState) {}

	open(id: string): boolean {
		const element = this.editor.activeElements.find((candidate) => candidate.id === id);
		if (
			!element ||
			!hasTextProperties(element) ||
			!element.textSegments?.some((s) => s.equationXml)
		) {
			return false;
		}
		this.editingId = id;
		this.editor.select(id);
		return true;
	}

	get omml(): Record<string, unknown> | null {
		const element = this.editingId
			? this.editor.activeElements.find((candidate) => candidate.id === this.editingId)
			: undefined;
		if (!element || !hasTextProperties(element)) {
			return null;
		}
		return (
			(element.textSegments?.find((segment) => segment.equationXml)?.equationXml as Record<
				string,
				unknown
			>) ?? null
		);
	}

	apply(omml: Record<string, unknown>): void {
		const id = this.editingId;
		if (!id) {
			return;
		}
		this.editor.commitActiveElements(
			this.editor.activeElements.map((element): PptxElement => {
				if (element.id !== id || !hasTextProperties(element)) {
					return element;
				}
				let replaced = false;
				const textSegments = (element.textSegments ?? []).map((segment) => {
					if (!replaced && segment.equationXml) {
						replaced = true;
						return { ...segment, equationXml: omml };
					}
					return segment;
				});
				return { ...element, textSegments } as PptxElement;
			}),
		);
		this.close();
	}

	close(): void {
		this.editingId = null;
	}
}
