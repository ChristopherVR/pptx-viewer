import type {
	MasterViewTab,
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlideMaster,
} from 'pptx-viewer-core';

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

	activeElements(): PptxElement[] | null {
		const target = this.editor.masterViewTarget;
		if (!target) {
			return null;
		}
		if (target.tab === 'notes') {
			return this.editor.notesMaster?.elements ?? [];
		}
		if (target.tab === 'handout') {
			return this.editor.handoutMaster?.elements ?? [];
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
		if (target.tab === 'notes') {
			if (!this.editor.notesMaster) {
				return false;
			}
			this.editor.notesMaster = { ...this.editor.notesMaster, elements };
			return true;
		}
		if (target.tab === 'handout') {
			if (!this.editor.handoutMaster) {
				return false;
			}
			this.editor.handoutMaster = { ...this.editor.handoutMaster, elements };
			return true;
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
