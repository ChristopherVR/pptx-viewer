/**
 * presenter-console-strip.component.ts
 *
 * PowerPoint's presenter-console strip. A thin adapter around the shared
 * `pptx-ui-presenter-console`, which renders the SHARED inventory
 * (`PRESENTER_CONSOLE_CONTROLS`) with its order, ids, label keys, icons, glyphs
 * and pressed state; the on/disabled rule (`presenterConsoleViewState`) and the
 * meaning of a press (`presenterConsoleAction`) are shared too. What is left
 * here is what a press DOES to the presenter snapshot, which is the genuinely
 * per-binding half. Every control carries `data-pptx-presenter-control` so the
 * cross-binding e2e specs can address the strip by id instead of by (translated)
 * name.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import {
	presenterConsoleAction,
	presenterConsoleViewState,
	stepPresenterZoom,
} from '../internal/shared';
import type {
	PresentationSnapshot,
	PresenterConsoleRequestEvent,
	PresenterConsoleViewState,
} from '../internal/shared';
import { translationsSignal } from './translations-signal';

@Component({
	selector: 'pptx-presenter-console-strip',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: ':host { display: block; }',
	template: `
		<pptx-ui-presenter-console [state]="view()" (presenter-console-request)="request($event)" />
	`,
})
export class PresenterConsoleStripComponent {
	readonly snapshot = input.required<PresentationSnapshot>();
	readonly audienceOpen = input(false);

	/** A snapshot patch the console host applies and broadcasts. */
	readonly patch = output<Partial<PresentationSnapshot>>();
	/** "See all slides": open the slide navigator. */
	readonly showSlides = output<void>();
	readonly audience = output<void>();
	readonly swapDisplays = output<void>();
	readonly end = output<void>();

	private readonly translate = inject(TranslateService);
	private readonly translations = translationsSignal(this.translate);

	protected readonly view = computed<PresenterConsoleViewState>(() => {
		this.translations();
		return {
			...presenterConsoleViewState(this.snapshot(), this.audienceOpen()),
			translate: (key, params) => this.translate.instant(key, params),
		};
	});

	/**
	 * Run a slot's action.
	 *
	 * A slot the shared inventory grows before this switch learns it renders
	 * inert rather than firing a neighbour's handler: a missing behaviour shows
	 * up in the parity specs, a wrong one silently ends the show.
	 */
	protected request(event: Event): void {
		const action = presenterConsoleAction(
			(event as PresenterConsoleRequestEvent).detail.id,
			this.snapshot(),
		);
		switch (action?.kind) {
			case 'pointer':
				this.patch.emit({
					pointer: {
						...(this.snapshot().pointer ?? { x: 0.5, y: 0.5, color: '#ef4444' }),
						tool: action.tool,
					},
				});
				break;
			case 'blackout':
				this.patch.emit({ blackout: action.value });
				break;
			case 'zoom':
				this.patch.emit({
					zoom: stepPresenterZoom(
						this.snapshot().zoom ?? { scale: 1, originX: 0.5, originY: 0.5 },
						action.direction,
					),
				});
				break;
			case 'timer-toggle':
				this.patch.emit({ paused: !this.snapshot().paused });
				break;
			case 'timer-reset':
				this.patch.emit({ paused: false, elapsedMs: 0 });
				break;
			case 'all-slides':
				this.showSlides.emit();
				break;
			case 'zoom-reset':
				this.patch.emit({ zoom: { scale: 1, originX: 0.5, originY: 0.5 } });
				break;
			case 'captions':
				this.patch.emit({ subtitlesVisible: !this.snapshot().subtitlesVisible });
				break;
			case 'audience':
				this.audience.emit();
				break;
			case 'swap-displays':
				this.swapDisplays.emit();
				break;
			case 'end':
				this.end.emit();
				break;
			default:
			// An id the inventory does not know: nothing to do.
		}
	}
}
