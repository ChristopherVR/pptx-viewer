/**
 * ribbon-draw-section.component.ts: the Draw ribbon tab (tool selector, pen
 * colour, stroke width). Split out of {@link RibbonComponent}; behaviour and
 * markup are unchanged.
 *
 * The tool/colour/width state is owned by the parent ribbon (so it persists
 * across tab switches) and passed in via inputs; each interaction emits the full
 * {@link DrawToolState} the parent re-broadcasts as `drawToolChange`.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import {
	LucideMinus,
	LucideMoveRight,
	LucidePencil,
	LucideSpline,
	LucideType,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { RecentColorsService } from './recent-colors.service';

/** Drawing tool IDs (mirrors React DRAW_TOOLS). */
export type DrawTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform';

/** The full draw-tool state broadcast on every Draw-tab interaction. */
export interface DrawToolState {
	tool: DrawTool;
	color: string;
	width: number;
}

interface DrawToolDef {
	id: DrawTool;
	labelKey: string;
}

const DRAW_TOOLS: readonly DrawToolDef[] = [
	{ id: 'select', labelKey: 'pptx.ribbon.tool.select' },
	{ id: 'pen', labelKey: 'pptx.ribbon.tool.pen' },
	{ id: 'highlighter', labelKey: 'pptx.ribbon.tool.highlighter' },
	{ id: 'eraser', labelKey: 'pptx.ribbon.tool.eraser' },
	{ id: 'freeform', labelKey: 'pptx.ribbon.tool.freeform' },
];

@Component({
	selector: 'pptx-ribbon-draw-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		NgClass,
		TranslatePipe,
		LucideMoveRight,
		LucidePencil,
		LucideType,
		LucideMinus,
		LucideSpline,
	],
	template: `
		<!--
			Draw tool state is held in the parent ribbon and pushed up via
			drawToolChange; power-point-viewer.component.ts consumes it and appends
			real ink elements on stroke completion (see onDrawToolChange/
			onInkStrokeComplete there).
		-->
		<!-- Tool selector -->
		<div class="pptx-rb-grp">
			@for (tool of drawTools; track tool.id; let last = $last) {
				<button
					type="button"
					[class]="last ? 'pptx-rb-gl' : 'pptx-rb-gb'"
					[ngClass]="activeTool() === tool.id ? 'bg-primary text-primary-foreground' : ''"
					[title]="tool.labelKey | translate"
					(click)="selectTool(tool.id)"
				>
					@switch (tool.id) {
						@case ('select') {
							<svg lucideMoveRight class="h-4 w-4"></svg>
						}
						@case ('pen') {
							<svg lucidePencil class="h-4 w-4"></svg>
						}
						@case ('highlighter') {
							<svg lucideType class="h-4 w-4"></svg>
						}
						@case ('eraser') {
							<svg lucideMinus class="h-4 w-4"></svg>
						}
						@case ('freeform') {
							<svg lucideSpline class="h-4 w-4"></svg>
						}
					}
				</button>
			}
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Colour + width -->
		<label
			class="inline-flex items-center gap-1 text-xs text-muted-foreground"
			[title]="'pptx.ribbon.penColour' | translate"
		>
			{{ 'pptx.ribbon.colour' | translate }}
			<input
				type="color"
				[value]="drawingColor()"
				(input)="onColorInput($event)"
				(change)="onColorCommit($event)"
				class="h-6 w-6 cursor-pointer rounded border border-border bg-transparent"
			/>
		</label>
		<span class="pptx-rb-sep"></span>
		<label
			class="inline-flex items-center gap-1 text-xs text-muted-foreground"
			[title]="'pptx.ribbon.strokeWidth' | translate"
		>
			{{ 'pptx.ribbon.width' | translate }}
			<input
				type="range"
				min="1"
				max="12"
				[value]="drawingWidth()"
				(input)="onWidthInput($event)"
				class="h-1 w-16 accent-primary"
			/>
			<span class="w-4 text-right text-foreground">{{ drawingWidth() }}</span>
		</label>
	`,
})
export class RibbonDrawSectionComponent {
	readonly activeTool = input<DrawTool>('select');
	readonly drawingColor = input<string>('#000000');
	readonly drawingWidth = input<number>(3);

	readonly drawToolChange = output<DrawToolState>();

	/** Optional: absent in a standalone unit test with no viewer-level DI tree. */
	private readonly recentColors = inject(RecentColorsService, { optional: true });

	protected readonly drawTools = DRAW_TOOLS;

	protected selectTool(tool: DrawTool): void {
		this.drawToolChange.emit({ tool, color: this.drawingColor(), width: this.drawingWidth() });
	}

	protected onColorInput(event: Event): void {
		const color = (event.target as HTMLInputElement).value;
		this.drawToolChange.emit({ tool: this.activeTool(), color, width: this.drawingWidth() });
	}

	/**
	 * Record the committed (native `change`, not the live-preview `input`)
	 * pen colour into the shared "Recent colours" list.
	 */
	protected onColorCommit(event: Event): void {
		const color = (event.target as HTMLInputElement).value;
		this.recentColors?.push(color);
	}

	protected onWidthInput(event: Event): void {
		const width = Number((event.target as HTMLInputElement).value);
		this.drawToolChange.emit({ tool: this.activeTool(), color: this.drawingColor(), width });
	}
}
