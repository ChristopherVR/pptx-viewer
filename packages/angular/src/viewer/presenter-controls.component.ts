/**
 * presenter-controls.component.ts
 *
 * PowerPoint's presenter-console strip, rendered from the SHARED inventory
 * (`PRESENTER_CONSOLE_CONTROLS`) rather than hand-written.
 *
 * The hand-written version is what this replaces, and it had drifted in three
 * separate ways at once: it hard-coded English in an inline template with no
 * `translate` pipe anywhere (so the console was unreadable in de/es/fr), it
 * ordered zoom `-` before `+` where every other binding puts `+` first, and it
 * called reset-zoom "Fit". Worse, the blackout switches were labelled only by
 * their `B` / `W` glyph, so a screen reader announced the deck's black-screen
 * control as the letter "B".
 *
 * Now the order, ids, kinds, label keys, icon names, glyphs and Tailwind class
 * tokens all come from `pptx-viewer-shared`; the only thing left here is what a
 * press DOES, which is the genuinely per-binding half. Every control carries
 * `data-pptx-presenter-control` so the cross-binding e2e specs can address the
 * strip by id instead of by (now translated) name.
 */
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { PRESENTER_CONSOLE_CLASSES, stepPresenterZoom } from '../internal/shared';
import type { CanvasSize, PresentationSnapshot } from '../internal/shared';
import { presenterConsoleSlots } from './presenter-console-helpers';
import type { PresenterConsoleSlot } from './presenter-console-helpers';
import { PresenterConsoleIconComponent } from './presenter-console-icon.component';
import { PresenterSlideNavigatorComponent } from './presenter-slide-navigator.component';

@Component({
	selector: 'pptx-presenter-controls',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, PresenterConsoleIconComponent, PresenterSlideNavigatorComponent],
	styles: `
		:host {
			display: block;
		}
	`,
	template: `
		<div [class]="classes.strip" data-pptx-presenter-toolbar>
			@for (slot of slots(); track slot.id) {
				@if (slot.control.kind === 'divider' || slot.control.kind === 'spacer') {
					<span
						[attr.data-pptx-presenter-control]="slot.id"
						[class]="slot.control.kind === 'divider' ? classes.divider : classes.spacer"
					></span>
				} @else {
					<button
						type="button"
						[attr.data-pptx-presenter-control]="slot.id"
						[class]="slot.active ? classes.controlActive : classes.control"
						[disabled]="slot.disabled"
						[attr.aria-pressed]="slot.pressed"
						[attr.aria-label]="slot.labelKey ? (slot.labelKey | translate) : null"
						[title]="slot.labelKey ? (slot.labelKey | translate) : ''"
						(click)="activate(slot)"
					>
						<pptx-presenter-console-icon [name]="slot.iconName" />
						@if (slot.control.glyph) {
							<span aria-hidden="true">{{ slot.control.glyph }}</span>
						}
					</button>
				}
			}
		</div>
		@if (showSlides()) {
			<pptx-presenter-slide-navigator
				[slides]="slides()"
				[current]="current()"
				[canvasSize]="canvasSize()"
				[mediaDataUrls]="mediaDataUrls()"
				[templateElements]="templateElements()"
				(select)="select($event)"
				(close)="showSlides.set(false)"
			/>
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
	/** Master/layout elements drawn behind every navigator tile. */
	readonly templateElements = input<readonly PptxElement[]>([]);

	readonly patch = output<Partial<PresentationSnapshot>>();
	readonly navigate = output<number>();
	readonly audience = output<void>();
	readonly swapDisplays = output<void>();
	readonly end = output<void>();

	protected readonly classes = PRESENTER_CONSOLE_CLASSES;
	protected readonly showSlides = signal(false);

	protected readonly slots = computed<PresenterConsoleSlot[]>(() =>
		presenterConsoleSlots(this.snapshot(), this.audienceOpen()),
	);

	/**
	 * Run a slot's action.
	 *
	 * A slot the shared inventory grows before this switch learns it renders
	 * inert rather than firing a neighbour's handler: a missing behaviour shows
	 * up in the parity specs, a wrong one silently ends the show.
	 */
	protected activate(slot: PresenterConsoleSlot): void {
		if (slot.tool !== undefined) {
			this.setTool(slot.tool, slot.active);
			return;
		}
		switch (slot.id) {
			case 'timer-toggle':
				this.patch.emit({ paused: !this.snapshot().paused });
				break;
			case 'timer-reset':
				this.patch.emit({ paused: false, elapsedMs: 0 });
				break;
			case 'all-slides':
				this.showSlides.set(true);
				break;
			case 'zoom-in':
				this.zoom(1);
				break;
			case 'zoom-out':
				this.zoom(-1);
				break;
			case 'zoom-reset':
				this.patch.emit({ zoom: { scale: 1, originX: 0.5, originY: 0.5 } });
				break;
			case 'blackout-black':
				this.toggleBlank('black');
				break;
			case 'blackout-white':
				this.toggleBlank('white');
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
				break;
		}
	}

	private zoom(direction: -1 | 1): void {
		this.patch.emit({
			zoom: stepPresenterZoom(
				this.snapshot().zoom ?? { scale: 1, originX: 0.5, originY: 0.5 },
				direction,
			),
		});
	}

	private setTool(tool: PresenterConsoleSlot['tool'], active: boolean): void {
		if (tool === undefined) {
			return;
		}
		this.patch.emit({
			pointer: {
				...(this.snapshot().pointer ?? { x: 0.5, y: 0.5, color: '#ef4444' }),
				tool: active ? 'none' : tool,
			},
		});
	}

	private toggleBlank(value: 'black' | 'white'): void {
		this.patch.emit({ blackout: this.snapshot().blackout === value ? 'none' : value });
	}

	protected select(index: number): void {
		this.navigate.emit(index);
		this.showSlides.set(false);
	}
}
