/**
 * ribbon-drawing-group.component.ts: Drawing group for the Home tab ribbon.
 * Provides shape insertion, layer arrangement, and shape formatting placeholders.
 *
 * Shape picks insert straight through the shared {@link EditorStateService}
 * (like the Insert and Arrange sections do), matching React's immediate-insert
 * behaviour (DrawingGroup -> onAddShape): the element appears at a default
 * position, becomes the selection, marks the deck dirty, and is undoable.
 * The picker lists the first 12 entries of the shared preset catalogue
 * ({@link SHAPE_PRESET_DEFS}), so the geometry ids are valid OOXML
 * `a:prstGeom` values shared with every binding.
 */
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { SHAPE_PRESET_DEFS } from '../internal/shared';
import type { ShapePresetDef } from '../internal/shared';
import { newPresetShapeElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';

/** The quick "top shapes" row shared with React's toolbar (first 12 presets). */
const TOP_SHAPES: readonly ShapePresetDef[] = SHAPE_PRESET_DEFS.slice(0, 12);

@Component({
	selector: 'pptx-ribbon-drawing-group',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe, LucideChevronDown],
	template: `
		<!-- Shapes -->
		<div class="flex flex-col items-center gap-0.5">
			<div class="pptx-rb-grp">
				<div class="relative">
					<button
						type="button"
						class="pptx-rb-gb gap-1.5"
						[disabled]="!canEdit()"
						[title]="'pptx.drawing.shapes' | translate"
						(click)="shapesOpen.set(!shapesOpen())"
					>
						{{ 'pptx.drawing.shapes' | translate }} <svg lucideChevronDown class="h-3 w-3"></svg>
					</button>
					@if (shapesOpen()) {
						<div
							class="absolute left-0 top-full z-50 mt-0.5 grid grid-cols-4 gap-0.5 rounded border border-border bg-popover p-1 shadow-md"
						>
							@for (shape of shapes; track shape.type) {
								<button
									type="button"
									class="rounded px-1.5 py-0.5 text-[10px] hover:bg-accent"
									(click)="onShapeSelect(shape)"
								>
									{{ shape.i18nKey | translate }}
								</button>
							}
						</div>
					}
				</div>
				<!-- Arrange -->
				<div class="relative">
					<button
						type="button"
						class="pptx-rb-gb gap-1.5"
						[disabled]="!canEdit() || !editor.hasSelection()"
						[title]="'pptx.ribbon.arrange' | translate"
						(click)="arrangeOpen.set(!arrangeOpen())"
					>
						{{ 'pptx.ribbon.arrange' | translate }} <svg lucideChevronDown class="h-3 w-3"></svg>
					</button>
					@if (arrangeOpen()) {
						<div
							class="absolute left-0 top-full z-50 mt-0.5 flex flex-col rounded border border-border bg-popover p-1 shadow-md"
						>
							<button
								type="button"
								class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
								(click)="onArrange('up')"
							>
								{{ 'pptx.arrange.bringForward' | translate }}
							</button>
							<button
								type="button"
								class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
								(click)="onArrange('down')"
							>
								{{ 'pptx.arrange.sendBackward' | translate }}
							</button>
							<button
								type="button"
								class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
								(click)="onArrangeEdge('front')"
							>
								{{ 'pptx.arrange.bringToFront' | translate }}
							</button>
							<button
								type="button"
								class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
								(click)="onArrangeEdge('back')"
							>
								{{ 'pptx.arrange.sendToBack' | translate }}
							</button>
						</div>
					}
				</div>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.ribbon.groupDrawing' | translate }}
			</span>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Shape formatting (placeholders) -->
		<div class="flex flex-col items-center gap-0.5">
			<div class="pptx-rb-grp">
				<button type="button" class="pptx-rb-gb" disabled>
					{{ 'pptx.drawing.shapeFill' | translate }}
				</button>
				<button type="button" class="pptx-rb-gb" disabled>
					{{ 'pptx.drawing.shapeOutline' | translate }}
				</button>
				<button type="button" class="pptx-rb-gb" disabled>
					{{ 'pptx.drawing.shapeEffectsUnavailable' | translate }}
				</button>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.ribbon.groupShapeStyles' | translate }}
			</span>
		</div>
	`,
})
export class RibbonDrawingGroupComponent {
	protected readonly editor = inject(EditorStateService);

	readonly canEdit = input<boolean>(false);
	/** Index of the active slide (insertion target). */
	readonly slideIndex = input<number>(0);

	protected readonly shapes = TOP_SHAPES;
	protected readonly shapesOpen = signal(false);
	protected readonly arrangeOpen = signal(false);

	/** Insert the picked preset immediately (selects it and records history). */
	protected onShapeSelect(shape: ShapePresetDef): void {
		this.shapesOpen.set(false);
		this.editor.addElement(this.slideIndex(), newPresetShapeElement(shape.type, shape.label));
	}

	protected onArrange(direction: 'up' | 'down'): void {
		this.arrangeOpen.set(false);
		if (direction === 'up') {
			this.editor.bringSelectedForward(this.slideIndex());
			return;
		}
		this.editor.sendSelectedBackward(this.slideIndex());
	}

	protected onArrangeEdge(edge: 'front' | 'back'): void {
		this.arrangeOpen.set(false);
		if (edge === 'front') {
			this.editor.bringSelectedToFront(this.slideIndex());
			return;
		}
		this.editor.sendSelectedToBack(this.slideIndex());
	}
}
