import type {
	MasterViewTab,
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlideMaster,
} from 'pptx-viewer-core';
import { masterViewElements, replaceMasterViewElements } from 'pptx-viewer-shared';
import type { MasterViewDocument } from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

export interface MasterViewTarget {
	tab: MasterViewTab;
	masterIndex: number;
	layoutIndex: number | null;
}

/** Routes the active editing layer into a parsed slide master or layout. */
export class EditorMasterController {
	constructor(private readonly editor: EditorState) {}

	enter(masterIndex = 0, layoutIndex: number | null = null): void {
		this.editor.masterViewTarget = { tab: 'slides', masterIndex, layoutIndex };
		this.editor.editTemplateMode = true;
		this.editor.selection.clear();
	}

	enterTab(tab: MasterViewTab): void {
		const current = this.editor.masterViewTarget;
		this.editor.masterViewTarget = {
			tab,
			masterIndex: current?.masterIndex ?? 0,
			layoutIndex: tab === 'slides' ? (current?.layoutIndex ?? null) : null,
		};
		this.editor.editTemplateMode = true;
		this.editor.selection.clear();
	}

	exit(): void {
		this.editor.masterViewTarget = null;
		this.editor.editTemplateMode = false;
		this.editor.selection.clear();
	}

	/** The document shape the shared master-view rules operate on. */
	private document(): MasterViewDocument {
		return {
			slideMasters: this.editor.slideMasters,
			notesMaster: this.editor.notesMaster,
			handoutMaster: this.editor.handoutMaster,
		};
	}

	activeElements(): PptxElement[] | null {
		const target = this.editor.masterViewTarget;
		return target ? masterViewElements(this.document(), target) : null;
	}

	replace(elements: PptxElement[]): boolean {
		const target = this.editor.masterViewTarget;
		if (!target) {
			return false;
		}
		// A layout view paints its master's artwork too, so the shared rule
		// routes each element back to the part that actually owns it rather
		// than dropping the whole list into the selected layout.
		const write = replaceMasterViewElements(this.document(), target, elements);
		if (!write) {
			return false;
		}
		if (write.slideMasters) {
			this.editor.slideMasters = write.slideMasters;
		}
		if (write.notesMaster) {
			this.editor.notesMaster = write.notesMaster;
		}
		if (write.handoutMaster) {
			this.editor.handoutMaster = write.handoutMaster;
		}
		return true;
	}

	cloneMasters(): PptxSlideMaster[] {
		return structuredClone(this.editor.slideMasters);
	}

	cloneNotesMaster(): PptxNotesMaster | undefined {
		return structuredClone(this.editor.notesMaster);
	}

	cloneHandoutMaster(): PptxHandoutMaster | undefined {
		return structuredClone(this.editor.handoutMaster);
	}

	setHandoutSlidesPerPage(slidesPerPage: number): void {
		if (!this.editor.editable || !this.editor.handoutMaster) {
			return;
		}
		this.editor.pushHistory();
		this.editor.handoutMaster = { ...this.editor.handoutMaster, slidesPerPage };
		this.editor.commitChange();
	}

	setBackgroundColor(backgroundColor: string): void {
		const target = this.editor.masterViewTarget;
		if (!this.editor.editable || !target) {
			return;
		}
		this.editor.pushHistory();
		if (target.tab === 'notes' && this.editor.notesMaster) {
			this.editor.notesMaster = { ...this.editor.notesMaster, backgroundColor };
		} else if (target.tab === 'handout' && this.editor.handoutMaster) {
			this.editor.handoutMaster = { ...this.editor.handoutMaster, backgroundColor };
		} else if (target.tab === 'slides') {
			this.editor.slideMasters = this.editor.slideMasters.map((master, masterIndex) => {
				if (masterIndex !== target.masterIndex) {
					return master;
				}
				if (target.layoutIndex === null) {
					return { ...master, backgroundColor };
				}
				return {
					...master,
					layouts: master.layouts?.map((layout, layoutIndex) =>
						layoutIndex === target.layoutIndex ? { ...layout, backgroundColor } : layout,
					),
				};
			});
		}
		this.editor.commitChange();
	}
}
