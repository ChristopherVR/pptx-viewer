/**
 * ribbon-drawing-group.component.ts: Drawing group for the Home tab ribbon.
 * Provides shape insertion, layer arrangement, and shape formatting placeholders.
 */
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

interface ShapePreset {
	id: string;
	labelKey: string;
}

const SHAPE_PRESETS: readonly ShapePreset[] = [
	{ id: 'rectangle', labelKey: 'pptx.editorToolbar.shapeRectangle' },
	{ id: 'roundedRectangle', labelKey: 'pptx.editorToolbar.shapeRoundedRectangle' },
	{ id: 'ellipse', labelKey: 'pptx.editorToolbar.shapeEllipse' },
	{ id: 'triangle', labelKey: 'pptx.editorToolbar.shapeTriangle' },
	{ id: 'diamond', labelKey: 'pptx.shapePresets.diamond' },
	{ id: 'pentagon', labelKey: 'pptx.shapePresets.pentagon' },
	{ id: 'hexagon', labelKey: 'pptx.shapePresets.hexagon' },
	{ id: 'arrow', labelKey: 'pptx.shapePresets.arrow' },
	{ id: 'star5', labelKey: 'pptx.shapePresets.star' },
	{ id: 'heart', labelKey: 'pptx.shapePresets.heart' },
	{ id: 'cloud', labelKey: 'pptx.shapePresets.cloud' },
	{ id: 'callout', labelKey: 'pptx.editorToolbar.shapeCallout' },
];

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
							@for (shape of shapes; track shape.id) {
								<button
									type="button"
									class="rounded px-1.5 py-0.5 text-[10px] hover:bg-accent"
									(click)="onShapeSelect(shape.id)"
								>
									{{ shape.labelKey | translate }}
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
						[disabled]="!canEdit()"
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
	readonly canEdit = input<boolean>(false);
	readonly shapeInsert = output<string>();
	readonly moveLayer = output<string>();
	readonly moveLayerToEdge = output<string>();

	protected readonly shapes = SHAPE_PRESETS;
	protected readonly shapesOpen = signal(false);
	protected readonly arrangeOpen = signal(false);

	protected onShapeSelect(shape: string): void {
		this.shapesOpen.set(false);
		this.shapeInsert.emit(shape);
	}

	protected onArrange(direction: string): void {
		this.arrangeOpen.set(false);
		this.moveLayer.emit(direction);
	}

	protected onArrangeEdge(edge: string): void {
		this.arrangeOpen.set(false);
		this.moveLayerToEdge.emit(edge);
	}
}
