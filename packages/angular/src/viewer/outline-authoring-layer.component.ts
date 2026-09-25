/**
 * outline-authoring-layer.component.ts: stage-level host of the Edit Points
 * overlay and the Freeform: Shape / Curve capture overlay.
 *
 * Selector: `pptx-outline-authoring-layer`
 *
 * Projected into the scaled stage (like the motion-path overlay), so both
 * overlays work in raw slide pixels. It measures the stage's on-screen scale
 * (auto-fit folded with the user zoom) so handles keep one screen size, routes
 * each Edit Points commit through `EditorStateService.updateElement` (one undo
 * step) and each drawn shape through `addElement` (selected, one undo step),
 * and leaves Edit Points when its shape disappears or is no longer editable.
 *
 * Reference binding: packages/react/src/viewer/components/canvas/OutlineAuthoringLayer.tsx
 *
 * @module viewer/outline-authoring-layer
 */
import {
	afterRenderEffect,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
	signal,
	untracked,
} from '@angular/core';
import type { PptxElement, PptxSlide, ShapePptxElement } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import { canEditElementPoints, isEditPointsEnabled } from '../internal/shared';
import type { EditPointsCommit } from './edit-points-overlay.component';
import { EditPointsOverlayComponent } from './edit-points-overlay.component';
import { EditorStateService } from './editor-state.service';
import { FreeformToolOverlayComponent } from './freeform-tool-overlay.component';
import { OutlineAuthoringService } from './outline-authoring.service';
import { injectResolvedCustomization } from './viewer-customization.service';

@Component({
	selector: 'pptx-outline-authoring-layer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [EditPointsOverlayComponent, FreeformToolOverlayComponent],
	template: `
		@if (canEdit() && outline) {
			@if (outline.activeFreeformTool(); as tool) {
				<pptx-freeform-tool-overlay
					[tool]="tool"
					[canvasSize]="canvasSize()"
					[scale]="scale()"
					(commit)="onFreeformCommit($event)"
					(cancelled)="outline.armFreeformTool(null)"
				/>
			} @else if (editingElement(); as element) {
				<pptx-edit-points-overlay
					[element]="element"
					[canvasSize]="canvasSize()"
					[scale]="scale()"
					[hiddenCommands]="customization().hiddenEditPointsCommands"
					(commit)="onCommit($event)"
					(exit)="outline.exitEditPoints()"
				/>
			}
		}
	`,
	styles: `
		:host {
			position: absolute;
			inset: 0;
			pointer-events: none;
			overflow: visible;
		}
		:host > * {
			pointer-events: auto;
		}
	`,
})
export class OutlineAuthoringLayerComponent {
	readonly slide = input<PptxSlide | undefined>(undefined);
	readonly slideIndex = input.required<number>();
	readonly canvasSize = input.required<CanvasSize>();
	/** The user zoom: only a trigger to re-measure the stage's on-screen scale. */
	readonly zoom = input<number>(1);
	readonly canEdit = input<boolean>(false);

	protected readonly outline = inject(OutlineAuthoringService, { optional: true });
	private readonly editor = inject(EditorStateService);
	protected readonly customization = injectResolvedCustomization();
	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;
	protected readonly scale = signal(1);

	/** The shape in Edit Points mode, when it is still here and editable. */
	protected readonly editingElement = computed<PptxElement | null>(() => {
		const id = this.outline?.editPointsElementId();
		if (!id || !isEditPointsEnabled(this.customization())) {
			return null;
		}
		const element = this.slide()?.elements.find((candidate) => candidate.id === id);
		return element && canEditElementPoints(element) ? element : null;
	});

	constructor() {
		effect(() => {
			const id = this.outline?.editPointsElementId();
			const element = this.editingElement();
			if (id && !element) {
				untracked(() => this.outline?.exitEditPoints());
			}
		});
		afterRenderEffect(() => {
			this.zoom();
			const width = this.canvasSize().width;
			const rect = this.host.nativeElement.getBoundingClientRect();
			const next = width > 0 && rect.width > 0 ? rect.width / width : 1;
			if (Math.abs(next - untracked(this.scale)) > 1e-3) {
				this.scale.set(next);
			}
		});
	}

	protected onCommit(commit: EditPointsCommit): void {
		this.editor.updateElement(this.slideIndex(), commit.id, commit.patch);
	}

	protected onFreeformCommit(element: ShapePptxElement): void {
		this.outline?.armFreeformTool(null);
		this.editor.addElement(this.slideIndex(), element);
	}
}
