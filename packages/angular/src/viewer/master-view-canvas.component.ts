import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type {
	MasterViewTab,
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideMaster,
} from 'pptx-viewer-core';

import type { CanvasSize, MasterViewDocument, MasterViewTarget } from '../internal/shared';
import {
	DEFAULT_MASTER_PAGE_SIZE,
	masterViewPseudoSlide,
	updateMasterViewElement,
} from '../internal/shared';
import { SlideCanvasComponent } from './slide-canvas.component';

/** Editable Angular canvas for slide, notes, and handout master parts. */
@Component({
	selector: 'pptx-master-view-canvas',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [SlideCanvasComponent],
	template: `
		<main class="master-canvas" [attr.aria-label]="canvasLabel()">
			@if (pseudoSlide(); as slide) {
				<pptx-slide-canvas
					[slide]="slide"
					[canvasSize]="activeCanvasSize()"
					[mediaDataUrls]="mediaDataUrls()"
					[editable]="editable()"
					[editTemplateMode]="true"
					[selectedIds]="selectedIds()"
					[editingId]="editingId()"
					(elementSelect)="selectElement($event)"
					(backgroundClick)="selectedIds.set([])"
					(transformUpdate)="updateTransform($event)"
					(rotateUpdate)="updateTransform({ id: $event.id, box: { rotation: $event.rotation } })"
					(textEditStart)="editingId.set($event.id)"
					(textCommit)="commitText($event)"
					(textCancel)="editingId.set(null)"
				/>
			} @else {
				<p class="empty">No master is available.</p>
			}
		</main>
	`,
	styles: [
		`
			.master-canvas {
				display: flex;
				min-width: 0;
				flex: 1;
				overflow: hidden;
				background: var(--pptx-background, #11111b);
			}
			pptx-slide-canvas {
				display: flex;
				min-width: 0;
				flex: 1;
			}
			.empty {
				margin: auto;
				color: var(--pptx-muted-foreground, #a5a5b5);
			}
		`,
	],
})
export class MasterViewCanvasComponent {
	readonly tab = input.required<MasterViewTab>();
	readonly slideMasters = input.required<readonly PptxSlideMaster[]>();
	readonly activeMasterIndex = input(0);
	readonly activeLayoutIndex = input<number | null>(null);
	readonly notesMaster = input<PptxNotesMaster>();
	readonly handoutMaster = input<PptxHandoutMaster>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly notesCanvasSize = input<CanvasSize>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly editable = input(false);

	readonly notesMasterChange = output<PptxNotesMaster>();
	readonly handoutMasterChange = output<PptxHandoutMaster>();
	/** Slide-master / layout shape-tree edits made on the Slides tab. */
	readonly slideMastersChange = output<PptxSlideMaster[]>();

	protected readonly selectedIds = signal<readonly string[]>([]);
	protected readonly editingId = signal<string | null>(null);
	protected readonly activeCanvasSize = computed(() =>
		this.tab() === 'slides'
			? this.canvasSize()
			: this.tab() === 'notes'
				? (this.notesCanvasSize() ?? DEFAULT_MASTER_PAGE_SIZE)
				: DEFAULT_MASTER_PAGE_SIZE,
	);
	protected readonly canvasLabel = computed(() =>
		this.tab() === 'notes'
			? 'Notes Master'
			: this.tab() === 'handout'
				? 'Handout Master'
				: 'Slide Master',
	);
	/** The document + target shape the shared master-view rules operate on. */
	private readonly masterViewDocument = computed<MasterViewDocument>(() => ({
		slideMasters: this.slideMasters(),
		notesMaster: this.notesMaster(),
		handoutMaster: this.handoutMaster(),
	}));

	private readonly masterViewTarget = computed<MasterViewTarget>(() => ({
		tab: this.tab(),
		masterIndex: this.activeMasterIndex(),
		layoutIndex: this.activeLayoutIndex(),
	}));

	protected readonly pseudoSlide = computed<PptxSlide | undefined>(() =>
		masterViewPseudoSlide(this.masterViewDocument(), this.masterViewTarget()),
	);

	protected selectElement(event: { id: string; additive: boolean }): void {
		if (event.additive) {
			this.selectedIds.update((ids) =>
				ids.includes(event.id) ? ids.filter((id) => id !== event.id) : [...ids, event.id],
			);
		} else {
			this.selectedIds.set([event.id]);
		}
	}

	protected updateTransform(event: {
		id: string;
		box: { x?: number; y?: number; width?: number; height?: number; rotation?: number };
	}): void {
		this.updateMasterElement(event.id, event.box);
	}

	protected commitText(event: { id: string; text: string }): void {
		this.updateMasterElement(event.id, { text: event.text, textSegments: [] });
		this.editingId.set(null);
	}

	/**
	 * Route one element edit back to the part that owns it.
	 *
	 * This used to bail outright on the Slides tab, so every drag, rotate and
	 * text commit made on a slide master or layout was silently discarded.
	 * The routing decision now lives in `pptx-viewer-shared`, which also knows
	 * that a layout canvas paints its master's artwork too.
	 */
	private updateMasterElement(id: string, patch: Partial<PptxElement>): void {
		const write = updateMasterViewElement(
			this.masterViewDocument(),
			this.masterViewTarget(),
			id,
			patch,
		);
		if (!write) {
			return;
		}
		if (write.slideMasters) {
			this.slideMastersChange.emit(write.slideMasters);
		}
		if (write.notesMaster) {
			this.notesMasterChange.emit(write.notesMaster);
		}
		if (write.handoutMaster) {
			this.handoutMasterChange.emit(write.handoutMaster);
		}
	}
}
