/**
 * slide-size-card.component.ts: SLIDE SIZE card of the default (no-selection)
 * inspector, mirroring React's `SlideSizeCard`: width/height (px) inputs over
 * the loader's `canvasSize` signal.
 */
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import { LoadContentService } from './load-content.service';

@Component({
	selector: 'pptx-slide-size-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section class="icard">
			<h3 class="icard__heading">{{ 'pptx.slideSize.title' | translate }}</h3>
			<div class="icard__grid2">
				<label class="icard__row">
					<span class="icard__label">{{ 'pptx.slideSize.width' | translate }}</span>
					<input
						type="number"
						class="icard__input icard__input--number"
						min="1"
						[disabled]="!canEdit()"
						[value]="size().width"
						(change)="onChange($event, 'width')"
					/>
				</label>
				<label class="icard__row">
					<span class="icard__label">{{ 'pptx.slideSize.height' | translate }}</span>
					<input
						type="number"
						class="icard__input icard__input--number"
						min="1"
						[disabled]="!canEdit()"
						[value]="size().height"
						(change)="onChange($event, 'height')"
					/>
				</label>
			</div>
		</section>
	`,
	styles: [INSPECTOR_CARD_STYLES],
})
export class SlideSizeCardComponent {
	/** Whether the inputs are enabled. */
	readonly canEdit = input<boolean>(true);

	private readonly loader = inject(LoadContentService);
	private readonly editor = inject(EditorStateService);

	protected readonly size = this.loader.canvasSize;

	protected onChange(event: Event, dim: 'width' | 'height'): void {
		const value = Number((event.target as HTMLInputElement).value);
		if (!Number.isFinite(value) || value < 1) {
			return;
		}
		this.loader.canvasSize.update((current) => ({ ...current, [dim]: value }));
		this.editor.dirty.set(true);
	}
}
