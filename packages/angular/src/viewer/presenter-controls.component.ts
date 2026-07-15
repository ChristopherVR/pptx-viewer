import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import { stepPresenterZoom } from '../internal/shared';
import type { CanvasSize, PresentationPointerTool, PresentationSnapshot } from '../internal/shared';
import { SlideCanvasComponent } from './slide-canvas.component';

@Component({
	selector: 'pptx-presenter-controls',
	standalone: true,
	imports: [SlideCanvasComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: block;
		}
		.strip {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 4px;
			padding: 8px 12px;
			background: #020617;
			border-bottom: 1px solid #ffffff1a;
		}
		.strip button,
		.grid button {
			border: 0;
			border-radius: 5px;
			padding: 7px 10px;
			background: #ffffff12;
			color: #e2e8f0;
			cursor: pointer;
		}
		.strip button:hover,
		.strip .active {
			background: #38bdf8;
			color: #082f49;
		}
		.strip span {
			flex: 1;
		}
		.grid {
			position: fixed;
			inset: 0;
			z-index: 120;
			display: flex;
			flex-direction: column;
			background: #020617fa;
			color: #f8fafc;
		}
		.grid header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 18px 24px;
			border-bottom: 1px solid #ffffff1a;
		}
		.grid main {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
			gap: 20px;
			padding: 24px;
			overflow: auto;
		}
		.tile {
			text-align: left;
		}
		.tile.current {
			outline: 2px solid #38bdf8;
		}
		.tile.hidden {
			opacity: 0.45;
		}
		.preview {
			width: 200px;
			overflow: hidden;
		}
		.tile span {
			display: block;
			margin-top: 8px;
			color: #94a3b8;
		}
	`,
	template: `
		<div class="strip">
			<button (click)="patch.emit({paused:!snapshot().paused})">{{snapshot().paused?'Resume':'Pause'}}</button><button (click)="patch.emit({paused:false,elapsedMs:0})">Reset</button>
			<button (click)="showSlides.set(true)">All slides</button><button (click)="zoom(-1)">Zoom -</button><button (click)="zoom(1)">Zoom +</button><button (click)="patch.emit({zoom:{scale:1,originX:.5,originY:.5}})">Fit</button>
			@for(tool of tools;track tool){<button [class.active]="snapshot().pointer?.tool===tool" (click)="setTool(tool)">{{tool}}</button>}
			<button [class.active]="snapshot().blackout==='black'" (click)="toggleBlank('black')">B</button><button [class.active]="snapshot().blackout==='white'" (click)="toggleBlank('white')">W</button>
			<button [class.active]="snapshot().subtitlesVisible" (click)="patch.emit({subtitlesVisible:!snapshot().subtitlesVisible})">Captions</button><span></span><button (click)="audience.emit()">{{audienceOpen()?'Disconnect':'Audience'}}</button><button (click)="end.emit()">End</button>
		</div>
		@if(showSlides()){
			<div class="grid"><header><div><small>Slide navigator</small><h2>See all slides</h2></div><button (click)="showSlides.set(false)">Close</button></header><main>
				@for(slide of slides();track slide.id;let index=$index){<button class="tile" [class.current]="index===current()" [class.hidden]="slide.hidden" (click)="select(index)"><div class="preview" [style.height.px]="canvasSize().height*(200/canvasSize().width)"><pptx-slide-canvas [slide]="slide" [canvasSize]="canvasSize()" [mediaDataUrls]="mediaDataUrls()" [zoom]="200/canvasSize().width" [interactive]="false" /></div><span>{{index+1}}{{slide.hidden?' - hidden':''}}</span></button>}
			</main></div>
		}
	`,
})
export class PresenterControlsComponent {
	readonly snapshot = input.required<PresentationSnapshot>();
	readonly audienceOpen = input(false);
	readonly slides = input.required<PptxSlide[]>();
	readonly current = input.required<number>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input.required<Map<string, string>>();
	readonly patch = output<Partial<PresentationSnapshot>>();
	readonly navigate = output<number>();
	readonly audience = output<void>();
	readonly end = output<void>();
	protected readonly showSlides = signal(false);
	protected readonly tools: PresentationPointerTool[] = ['laser', 'pen', 'highlighter', 'eraser'];
	protected zoom(direction: -1 | 1): void {
		this.patch.emit({
			zoom: stepPresenterZoom(
				this.snapshot().zoom ?? { scale: 1, originX: 0.5, originY: 0.5 },
				direction,
			),
		});
	}
	protected setTool(tool: PresentationPointerTool): void {
		this.patch.emit({
			pointer: {
				...(this.snapshot().pointer ?? { x: 0.5, y: 0.5, color: '#ef4444' }),
				tool: this.snapshot().pointer?.tool === tool ? 'none' : tool,
			},
		});
	}
	protected toggleBlank(value: 'black' | 'white'): void {
		this.patch.emit({ blackout: this.snapshot().blackout === value ? 'none' : value });
	}
	protected select(index: number): void {
		this.navigate.emit(index);
		this.showSlides.set(false);
	}
}
