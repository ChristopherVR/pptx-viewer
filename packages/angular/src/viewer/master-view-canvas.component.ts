import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type {
	MasterViewTab,
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideMaster,
} from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import { DEFAULT_MASTER_PAGE_SIZE } from '../internal/shared';
import { SlideCanvasComponent } from './slide-canvas.component';

type MasterPart = PptxNotesMaster | PptxHandoutMaster;

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
	protected readonly pseudoSlide = computed<PptxSlide | undefined>(() => {
		if (this.tab() === 'notes') {
			return this.partAsSlide(this.notesMaster());
		}
		if (this.tab() === 'handout') {
			return this.partAsSlide(this.handoutMaster());
		}
		const master = this.slideMasters()[this.activeMasterIndex()];
		if (!master) {
			return undefined;
		}
		const layoutIndex = this.activeLayoutIndex();
		const layout = layoutIndex === null ? undefined : master.layouts?.[layoutIndex];
		return {
			id: layout?.path ?? master.path,
			rId: '',
			slideNumber: 0,
			elements: layout
				? [...(master.elements ?? []), ...(layout.elements ?? [])]
				: (master.elements ?? []),
			backgroundColor: layout?.backgroundColor ?? master.backgroundColor,
			backgroundImage: layout?.backgroundImage ?? master.backgroundImage,
		};
	});

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
		this.updateAuxiliaryElement(event.id, event.box);
	}

	protected commitText(event: { id: string; text: string }): void {
		this.updateAuxiliaryElement(event.id, { text: event.text, textSegments: [] });
		this.editingId.set(null);
	}

	private updateAuxiliaryElement(id: string, patch: Partial<PptxElement>): void {
		const part = this.tab() === 'notes' ? this.notesMaster() : this.handoutMaster();
		if (!part || this.tab() === 'slides') {
			return;
		}
		const next = {
			...part,
			elements: (part.elements ?? []).map((element) =>
				element.id === id ? ({ ...element, ...patch } as PptxElement) : element,
			),
		};
		if (this.tab() === 'notes') {
			this.notesMasterChange.emit(next as PptxNotesMaster);
		} else {
			this.handoutMasterChange.emit(next as PptxHandoutMaster);
		}
	}

	private partAsSlide(part: MasterPart | undefined): PptxSlide | undefined {
		return part
			? {
					id: part.path,
					rId: '',
					slideNumber: 0,
					elements: part.elements ?? [],
					backgroundColor: part.backgroundColor,
					backgroundImage: part.backgroundImage,
				}
			: undefined;
	}
}
