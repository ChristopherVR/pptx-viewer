import type { PptxElement, PptxSlideMaster } from 'pptx-viewer-core';

import type { EditorState } from './editor-state.svelte';

export interface MasterViewTarget {
	masterIndex: number;
	layoutIndex: number | null;
}

/** Routes the active editing layer into a parsed slide master or layout. */
export class EditorMasterController {
	constructor(private readonly editor: EditorState) {}

	enter(masterIndex = 0, layoutIndex: number | null = null): void {
		this.editor.masterViewTarget = { masterIndex, layoutIndex };
		this.editor.editTemplateMode = true;
		this.editor.selection.clear();
	}

	exit(): void {
		this.editor.masterViewTarget = null;
		this.editor.editTemplateMode = false;
		this.editor.selection.clear();
	}

	activeElements(): PptxElement[] | null {
		const target = this.editor.masterViewTarget;
		if (!target) {
			return null;
		}
		const master = this.editor.slideMasters[target.masterIndex];
		return target.layoutIndex === null
			? (master?.elements ?? [])
			: (master?.layouts?.[target.layoutIndex]?.elements ?? []);
	}

	replace(elements: PptxElement[]): boolean {
		const target = this.editor.masterViewTarget;
		if (!target) {
			return false;
		}
		this.editor.slideMasters = this.editor.slideMasters.map((master, masterIndex) => {
			if (masterIndex !== target.masterIndex) {
				return master;
			}
			if (target.layoutIndex === null) {
				return { ...master, elements };
			}
			return {
				...master,
				layouts: master.layouts?.map((layout, layoutIndex) =>
					layoutIndex === target.layoutIndex ? { ...layout, elements } : layout,
				),
			};
		});
		return true;
	}

	cloneMasters(): PptxSlideMaster[] {
		return structuredClone(this.editor.slideMasters);
	}
}
