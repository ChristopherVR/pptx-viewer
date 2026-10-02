/**
 * presentation-toolbar.component.ts: the floating bottom-centre toolbar of a
 * running slide show.
 *
 * Selector: `pptx-presentation-toolbar`
 *
 * A thin adapter around the shared `pptx-ui-present-toolbar`. The inventory, the
 * order, the measurements, the colour palettes and the elapsed readout are NOT
 * decided here: the element renders them from `PRESENT_TOOLBAR_CONTROLS` /
 * `PRESENT_TOOLBAR_METRICS` in `pptx-viewer-shared`, which is what stops this bar
 * drifting from the other four bindings again. Angular previously shipped a
 * bottom-LEFT strip of four annotation tools plus a captions button, so a
 * presenter had no visible way to step slides, read the elapsed time, open
 * presenter view or leave the show.
 *
 * The component HOST is the auto-hiding positioner (it carries
 * `PRESENT_TOOLBAR_CLASSES.wrapper` and the opacity), so the show overlay only has
 * to place the element; positioning and fade live with the behaviour that drives
 * them.
 *
 * Annotation state is read from the overlay-provided
 * {@link PresentationAnnotationsService} rather than passed in, the same way
 * `PresentationAnnotationOverlayComponent` does it, which keeps the input
 * surface to the four things the bar cannot know: where in the deck it is, when
 * the show started, whether presenter view is up, and how to leave.
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	DestroyRef,
	ElementRef,
	HostListener,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { isInBottomTriggerZone, PRESENT_TOOLBAR_CLASSES } from '../internal/shared';
import type {
	PresentToolbarIntent,
	PresentToolbarRequestEvent,
	PresentToolbarViewState,
} from '../internal/shared';
import { PresentationAnnotationsService } from './presentation-annotations.service';
import { PresentToolbarAutoHide, runBlackboardToggle } from './presentation-toolbar-view';
import { PresenterWindowService } from './presenter-window.service';
import { translationsSignal } from './translations-signal';

export type { PresentToolbarAction } from './presentation-toolbar-view';

@Component({
	selector: 'pptx-presentation-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<pptx-ui-present-toolbar [state]="view()" (present-toolbar-request)="request($event)" />
	`,
	styles: [':host { display: block; }'],
	host: {
		'[class]': 'wrapperClass',
		'[style.opacity]': 'visible() ? 1 : 0',
		'[style.pointer-events]': 'visible() ? "auto" : "none"',
		'(mouseenter)': 'onMouseEnter()',
		'(mouseleave)': 'onMouseLeave()',
	},
})
export class PresentationToolbarComponent {
	// ------------------------------------------------------------------
	// Inputs / outputs
	// ------------------------------------------------------------------

	/** Zero-based index of the slide on screen. */
	readonly currentSlideIndex = input.required<number>();
	/** Total slides in the show. */
	readonly totalSlides = input.required<number>();
	/** Epoch ms the show started; the readout counts from mount when `null`. */
	readonly presentationStartTime = input<number | null>(null);
	/** Whether the presenter view window is up (reflected on its toggle). */
	readonly presenterMode = input<boolean>(false);
	/** File > Options > Advanced > "Show popup toolbar" (default true). */
	readonly popupToolbarEnabled = input<boolean>(true);

	/** Step the show forward (1) or back (-1). */
	readonly move = output<1 | -1>();
	/** Leave the show. */
	readonly endPresentation = output<void>();
	/** Open or close the presenter view. */
	readonly presenterViewToggle = output<void>();

	// ------------------------------------------------------------------
	// Injected state
	// ------------------------------------------------------------------

	protected readonly annotations = inject(PresentationAnnotationsService);
	private readonly presenterWindow = inject(PresenterWindowService);
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly translate = inject(TranslateService);
	private readonly translations = translationsSignal(this.translate);

	protected readonly wrapperClass = PRESENT_TOOLBAR_CLASSES.wrapper;

	// ------------------------------------------------------------------
	// Derived state
	// ------------------------------------------------------------------

	/** Whether the bar is currently faded in (auto-hide). */
	readonly visible = signal(false);

	private readonly mountedAt = Date.now();

	protected readonly view = computed<PresentToolbarViewState>(() => {
		this.translations();
		return {
			current: this.currentSlideIndex(),
			total: this.totalSlides(),
			tool: this.annotations.tool(),
			penColor: this.annotations.penColor(),
			highlighterColor: this.annotations.highlighterColor(),
			hasAnnotations: this.annotations.annotationStrokes().length > 0,
			blackout: this.presenterWindow.snapshot().blackout,
			presenterViewVisible: true,
			presenterViewActive: this.presenterMode(),
			startTime: this.presentationStartTime() ?? this.mountedAt,
			translate: (key, params) => this.translate.instant(key, params),
		};
	});

	private readonly autoHide = new PresentToolbarAutoHide((value) => {
		this.visible.set(value);
	});

	constructor() {
		inject(DestroyRef).onDestroy(() => {
			this.autoHide.dispose();
		});
	}

	// ------------------------------------------------------------------
	// Auto-hide
	// ------------------------------------------------------------------

	@HostListener('document:mousemove', ['$event'])
	protected onDocumentMouseMove(event: MouseEvent): void {
		if (!this.popupToolbarEnabled()) {
			return;
		}
		const surface = this.host.nativeElement.parentElement;
		if (surface) {
			const rect = surface.getBoundingClientRect();
			if (isInBottomTriggerZone(event.clientY, rect.height, rect.top)) {
				this.autoHide.poke();
				return;
			}
		}
		// Any movement reveals the bar and restarts the countdown.
		this.autoHide.poke();
	}

	/** PowerPoint's Ctrl+H: flip the bar's visibility. */
	toggleVisible(): void {
		this.visible.update((shown) => !shown);
	}

	protected onMouseEnter(): void {
		this.autoHide.enter();
	}

	protected onMouseLeave(): void {
		this.autoHide.leave();
	}

	// ------------------------------------------------------------------
	// Controls
	// ------------------------------------------------------------------

	protected request(event: Event): void {
		const intent: PresentToolbarIntent = (event as PresentToolbarRequestEvent).detail;
		switch (intent.id) {
			case 'move':
				this.move.emit(intent.direction);
				return;
			case 'tool':
				this.annotations.setTool(intent.tool);
				return;
			case 'color':
				if (intent.tool === 'pen') {
					this.annotations.setPenColor(intent.color);
				} else {
					this.annotations.setHighlighterColor(intent.color);
				}
				if (this.annotations.tool() !== intent.tool) {
					this.annotations.setTool(intent.tool);
				}
				return;
			case 'blackboard':
				runBlackboardToggle({
					blackout: this.presenterWindow.snapshot().blackout,
					tool: this.annotations.tool(),
					setBlackout: (blackout) => this.presenterWindow.updateSnapshot({ blackout }),
					setTool: (tool) => this.annotations.setTool(tool),
				});
				return;
			case 'clear':
				this.annotations.clearAnnotations();
				return;
			case 'presenterView':
				this.presenterViewToggle.emit();
				return;
			case 'end':
				this.endPresentation.emit();
		}
	}
}
