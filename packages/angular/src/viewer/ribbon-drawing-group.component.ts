/**
 * ribbon-drawing-group.component.ts: Drawing group for the Home tab ribbon.
 * Provides shape insertion, layer arrangement, and shape formatting placeholders.
 */
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

const SHAPE_PRESETS: readonly string[] = [
	'rectangle',
	'roundedRectangle',
	'ellipse',
	'triangle',
	'diamond',
	'pentagon',
	'hexagon',
	'arrow',
	'star5',
	'heart',
	'cloud',
	'callout',
];

@Component({
	selector: 'pptx-ribbon-drawing-group',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe],
	template: `
		<!-- Shapes -->
		<div class="flex flex-col items-center gap-0.5">
			<div class="pptx-rb-grp">
				<div class="relative">
					<button
						type="button"
						class="pptx-rb-gb"
						[disabled]="!canEdit()"
						[title]="'pptx.ribbon.shapes' | translate"
						(click)="shapesOpen.set(!shapesOpen())"
					>
						{{ 'pptx.ribbon.shapes' | translate }} ▾
					</button>
					@if (shapesOpen()) {
						<div
							class="absolute left-0 top-full z-50 mt-0.5 grid grid-cols-4 gap-0.5 rounded border border-border bg-popover p-1 shadow-md"
						>
							@for (shape of shapes; track shape) {
								<button
									type="button"
									class="rounded px-1.5 py-0.5 text-[10px] hover:bg-accent"
									(click)="onShapeSelect(shape)"
								>
									{{ shape }}
								</button>
							}
						</div>
					}
				</div>
				<!-- Arrange -->
				<div class="relative">
					<button
						type="button"
						class="pptx-rb-gb"
						[disabled]="!canEdit()"
						[title]="'pptx.arrange.arrange' | translate"
						(click)="arrangeOpen.set(!arrangeOpen())"
					>
						{{ 'pptx.arrange.arrange' | translate }} ▾
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
				{{ 'pptx.ribbon.drawing' | translate }}
			</span>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Shape formatting (placeholders) -->
		<div class="flex flex-col items-center gap-0.5">
			<div class="pptx-rb-grp">
				<button type="button" class="pptx-rb-gb" disabled>
					{{ 'pptx.ribbon.shapeFill' | translate }}
				</button>
				<button type="button" class="pptx-rb-gb" disabled>
					{{ 'pptx.ribbon.shapeOutline' | translate }}
				</button>
				<button type="button" class="pptx-rb-gb" disabled>
					{{ 'pptx.ribbon.shapeEffects' | translate }}
				</button>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.ribbon.shapeStyles' | translate }}
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
