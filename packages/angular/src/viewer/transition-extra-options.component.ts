/**
 * transition-extra-options.component.ts: the "Pattern" button row (glitter's
 * diamond/hexagon, shred's strip/rectangle) and "Through Black" checkbox for
 * the slide-transition card, split out of `slide-transition-card.component.ts`
 * to keep it under the project's per-file LOC budget. Mirrors React's inline
 * pattern/thruBlk controls in `inspector/SlideTransitionSection.tsx`.
 *
 * Selector: `pptx-transition-extra-options`
 *
 * @module viewer/transition-extra-options
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	input,
	output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
	selector: 'pptx-transition-extra-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		@if (patternOptions(); as patterns) {
			<div class="icard__col">
				<span class="icard__label">{{ 'pptx.transition.pattern' | translate }}</span>
				<div class="pattern">
					@for (pattern of patterns; track pattern) {
						<button
							type="button"
							class="pattern__btn"
							[class.is-active]="(value() ?? patterns[0]) === pattern"
							[disabled]="disabled()"
							[attr.aria-pressed]="(value() ?? patterns[0]) === pattern"
							(click)="patternPick.emit(pattern)"
						>
							{{ 'pptx.transition.pattern.' + pattern | translate }}
						</button>
					}
				</div>
			</div>
		}
		@if (showThruBlk()) {
			<label class="check">
				<pptx-ui-checkbox
					[disabled]="disabled()"
					[checked]="thruBlk() === true"
					[attr.aria-label]="'pptx.transition.thruBlk' | translate"
					(change)="onThruBlk($event)"
				></pptx-ui-checkbox>
				<span>{{ 'pptx.transition.thruBlk' | translate }}</span>
			</label>
		}
	`,
	styles: `
		:host {
			display: contents;
		}
		.pattern {
			display: flex;
			gap: 4px;
		}
		.pattern__btn {
			padding: 2px 8px;
			background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			color: inherit;
			font: inherit;
			font-size: 11px;
			cursor: pointer;
		}
		.pattern__btn:disabled {
			opacity: 0.5;
			cursor: default;
		}
		.pattern__btn.is-active {
			background: var(--pptx-inspector-active, #0078d4);
			border-color: var(--pptx-inspector-active, #0078d4);
			color: #fff;
		}
	`,
})
export class TransitionExtraOptionsComponent {
	/** Valid pattern tokens for the current transition type, or undefined. */
	readonly patternOptions = input<readonly string[] | undefined>(undefined);
	/** Currently selected pattern token, if any. */
	readonly value = input<string | undefined>(undefined);
	/** Whether the Through Black checkbox should render at all. */
	readonly showThruBlk = input<boolean>(false);
	/** Current `thruBlk` value. */
	readonly thruBlk = input<boolean | undefined>(undefined);
	/** Whether the controls are inert (read-only deck). */
	readonly disabled = input<boolean>(false);

	/** The pattern token the user chose. */
	readonly patternPick = output<string>();
	/** The new `thruBlk` value the user chose. */
	readonly thruBlkChange = output<boolean>();

	protected onThruBlk(event: Event): void {
		this.thruBlkChange.emit((event.target as HTMLInputElement).checked);
	}
}
