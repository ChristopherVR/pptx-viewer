import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type {
	MasterViewTab,
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideMaster,
	TextStyle,
} from 'pptx-viewer-core';

import type {
	CanvasSize,
	InlineListController,
	InlineTextEditSnapshot,
	MasterViewDocument,
	MasterViewTarget,
	MasterViewWrite,
} from '../internal/shared';
import {
	buildInlineTextCommitPatch,
	DEFAULT_MASTER_PAGE_SIZE,
	deleteMasterViewElements,
	masterViewPseudoSlide,
	updateMasterViewElement,
} from '../internal/shared';
import { InlineListSession } from './inline-list-session';
import { formatInlineListStyle } from './ribbon-text-helpers';
import { SlideCanvasComponent } from './slide-canvas.component';

/** Editable Angular canvas for slide, notes, and handout master parts. */
@Component({
	selector: 'pptx-master-view-canvas',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [SlideCanvasComponent],
	template: `
		<main
			class="master-canvas"
			[attr.aria-label]="canvasLabel()"
			[attr.tabindex]="editable() ? 0 : null"
			(keydown)="onKeyDown($event)"
		>
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
					(textInput)="receiveInlineSnapshot($event)"
					(listSession)="receiveListSession($event)"
					(textFormat)="formatText($event)"
					(textCancel)="editingId.set(null)"
				/>
			} @else {
				<p class="empty">No master is available.</p>
			}
		</main>
	`,
	styles: [
		`
			/*
			 * The host element itself, not just the <main> inside it.
			 *
			 * A custom element defaults to display:inline, so this component was
			 * shrink-to-fit inside the overlay's flex row while everything under
			 * it declared flex:1 against that content-driven box. The canvas
			 * measures its viewport to compute a fit scale, and the scaled stage
			 * is the content that sizes the box, so the ResizeObserver fed itself:
			 * the master view visibly collapsed on every tick (1232px -> 736 ->
			 * 256 -> ...), which is why nothing on it could be clicked. The other
			 * child of the overlay is fixed-width, so only this one loops.
			 */
			:host {
				display: flex;
				min-width: 0;
				min-height: 0;
				flex: 1;
			}
			.master-canvas {
				display: flex;
				min-width: 0;
				min-height: 0;
				flex: 1;
				overflow: hidden;
				background: var(--pptx-background, #11111b);
			}
			pptx-slide-canvas {
				display: flex;
				min-width: 0;
				min-height: 0;
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
	private inlineSnapshot?: InlineTextEditSnapshot;
	private readonly listSession = new InlineListSession(
		() => this.pseudoSlide()?.elements.find((element) => element.id === this.editingId()),
		() => {
			this.inlineSnapshot = undefined;
			this.editingId.set(null);
		},
	);
	protected receiveListSession(event: { controller: InlineListController; active: boolean }): void {
		this.listSession.register(event);
	}
	protected formatText(event: { id: string; updates: Partial<TextStyle> }): void {
		const element = this.pseudoSlide()?.elements.find((candidate) => candidate.id === event.id);
		const snapshot = this.readInlineSnapshot();
		if (!this.editable() || !element || !snapshot) {
			return;
		}
		const patch = formatInlineListStyle(element, event.updates, snapshot, (next) =>
			this.listSession.format(next),
		);
		if (patch) {
			this.updateMasterElement(event.id, patch);
		}
	}
	readInlineSnapshot(): InlineTextEditSnapshot | undefined {
		const current = this.listSession.read();
		if (current && this.editingId()) {
			return current;
		}
		return this.inlineSnapshot?.elementId === this.editingId() ? this.inlineSnapshot : undefined;
	}
	protected receiveInlineSnapshot(event: {
		id: string;
		text: string;
		snapshot?: InlineTextEditSnapshot;
	}): void {
		const current = this.listSession.read();
		if (event.id !== this.editingId()) {
			return;
		}
		if (current) {
			event = { id: event.id, text: current.text, snapshot: current };
		}
		this.inlineSnapshot =
			event.id === this.editingId() &&
			event.snapshot?.elementId === event.id &&
			event.snapshot.text === event.text
				? event.snapshot
				: undefined;
	}
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

	protected commitText(event: {
		id: string;
		text: string;
		height?: number;
		snapshot?: InlineTextEditSnapshot;
	}): void {
		const element = this.pseudoSlide()?.elements.find((candidate) => candidate.id === event.id);
		const textPatch = buildInlineTextCommitPatch(element, event.text, event.snapshot);
		if (!textPatch && event.height === undefined) {
			this.editingId.set(null);
			return;
		}
		this.updateMasterElement(event.id, {
			...textPatch,
			// `a:spAutoFit`: see `slide-canvas.component.ts`'s `commitText`.
			...(event.height !== undefined ? { height: event.height } : {}),
		});
		this.editingId.set(null);
	}

	/** Route edits to the owning part, including a master's artwork painted on a layout. */
	private updateMasterElement(id: string, patch: Partial<PptxElement>): void {
		this.emitWrite(
			updateMasterViewElement(this.masterViewDocument(), this.masterViewTarget(), id, patch),
		);
	}

	/**
	 * Delete the selected master/layout shapes.
	 *
	 * The canvas has to own this key: selection here is local to the component,
	 * and the deck-wide handler resolves ids against `slides`, where a master
	 * part's shapes do not exist. Pressing Delete over the master overlay used
	 * to do nothing at all (or, with a slide element still selected behind the
	 * overlay, delete the wrong thing).
	 */
	protected onKeyDown(event: KeyboardEvent): void {
		if (!this.editable() || this.editingId() !== null || this.selectedIds().length === 0) {
			return;
		}
		if (event.key !== 'Delete' && event.key !== 'Backspace') {
			return;
		}
		event.preventDefault();
		this.emitWrite(
			deleteMasterViewElements(
				this.masterViewDocument(),
				this.masterViewTarget(),
				this.selectedIds(),
			),
		);
		this.selectedIds.set([]);
	}

	private emitWrite(write: MasterViewWrite | null): void {
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
