import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import type { RibbonDrawRequestEvent, RibbonDrawTool } from '../internal/shared';
import { RecentColorsService } from './recent-colors.service';

export type DrawTool = RibbonDrawTool;
export interface DrawToolState {
	tool: DrawTool;
	color: string;
	width: number;
}

@Component({
	selector: 'pptx-ribbon-draw-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-ribbon-draw [state]="view()" (draw-request)="request($event)" />`,
})
export class RibbonDrawSectionComponent {
	readonly activeTool = input<DrawTool>('select');
	readonly drawingColor = input('#000000');
	readonly drawingWidth = input(3);
	readonly canEdit = input(true);
	readonly drawToolChange = output<DrawToolState>();
	private readonly recentColors = inject(RecentColorsService, { optional: true });
	private readonly translation = inject(TranslateService, { optional: true });
	protected view() {
		return {
			tool: this.activeTool(),
			color: this.drawingColor(),
			width: this.drawingWidth(),
			editable: this.canEdit(),
			recentColors: this.recentColors?.recent?.() ?? [],
			translate: (key: string) => this.translation?.instant(key) ?? key,
		};
	}
	protected request(event: Event): void {
		if (!this.canEdit()) {
			return;
		}
		const intent = (event as RibbonDrawRequestEvent).detail;
		switch (intent.kind) {
			case 'tool':
				this.selectTool(intent.value);
				break;
			case 'width':
				this.emit({ width: intent.value });
				break;
			case 'color':
				this.emit({ color: intent.value });
				if (intent.committed) {
					this.recentColors?.push(intent.value);
				}
		}
	}
	private emit(patch: Partial<DrawToolState>): void {
		this.drawToolChange.emit({
			tool: this.activeTool(),
			color: this.drawingColor(),
			width: this.drawingWidth(),
			...patch,
		});
	}
	protected selectTool(tool: DrawTool): void {
		this.emit({ tool });
	}
	protected onColorInput(event: Event): void {
		this.emit({ color: (event.target as HTMLInputElement).value });
	}
	protected onColorCommit(event: Event): void {
		this.recentColors?.push((event.target as HTMLInputElement).value);
	}
	protected onWidthInput(event: Event): void {
		this.emit({ width: Number((event.target as HTMLInputElement).value) });
	}
}
