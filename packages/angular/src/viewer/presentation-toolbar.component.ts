/**
 * presentation-toolbar.component.ts: the floating bottom-centre toolbar of a
 * running slide show.
 *
 * Selector: `pptx-presentation-toolbar`
 *
 * The inventory, the order and the measurements are NOT decided here: they come
 * from `PRESENT_TOOLBAR_CONTROLS` / `PRESENT_TOOLBAR_CLASSES` in
 * `pptx-viewer-shared`, which is what stops this bar drifting from the other
 * four bindings again. Angular previously shipped a bottom-LEFT strip of four
 * annotation tools plus a captions button, so a presenter had no visible way to
 * step slides, read the elapsed time, open presenter view or leave the show.
 *
 * The bar is the component HOST (it carries `PRESENT_TOOLBAR_CLASSES.wrapper`
 * and the auto-hide opacity), so the show overlay only has to place the element;
 * positioning and fade live with the behaviour that drives them.
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
	DestroyRef,
	ElementRef,
	HostListener,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import {
	LucideChevronDown,
	LucideChevronLeft,
	LucideChevronRight,
	LucideEraser,
	LucideHighlighter,
	LucideMousePointer2,
	LucidePanelRight,
	LucidePenTool,
	LucidePresentation,
	LucideTimer,
	LucideTrash2,
	LucideX,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { formatSlideCounter, isBlackboardActive, isInBottomTriggerZone } from '../internal/shared';
import { PresentationAnnotationsService } from './presentation-annotations.service';
import type { PresentationTool } from './presentation-annotations.service';
import {
	PRESENT_TOOLBAR_VIEW,
	PresentToolbarAutoHide,
	isAtFirstSlide,
	isAtLastSlide,
	runBlackboardToggle,
} from './presentation-toolbar-view';
import type { OpenPalette, PresentToolbarAction } from './presentation-toolbar-view';
import { elapsedSince, formatElapsed } from './presenter-view-helpers';
import { PresenterWindowService } from './presenter-window.service';

export type { PresentToolbarAction } from './presentation-toolbar-view';

@Component({
	selector: 'pptx-presentation-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TranslatePipe,
		LucideChevronDown,
		LucideChevronLeft,
		LucideChevronRight,
		LucideEraser,
		LucideHighlighter,
		LucideMousePointer2,
		LucidePanelRight,
		LucidePenTool,
		LucidePresentation,
		LucideTimer,
		LucideTrash2,
		LucideX,
	],
	templateUrl: './presentation-toolbar.component.html',
	styles: [':host { display: block; }'],
	host: {
		'[class]': 'ui.wrapper',
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
	readonly totalSlides = input.required<number>();
	/**
	 * Epoch ms the show started. Defaults to this bar's own construction, which
	 * IS the moment the show overlay appeared, so the readout ticks from zero
	 * even for a host that tracks no start time of its own.
	 */
	readonly presentationStartTime = input<number | null>(null);
	/** Whether presenter view is currently up (tints the toggle). */
	readonly presenterMode = input<boolean>(false);
	/**
	 * File > Options > Advanced > "Show popup toolbar" (default true). When
	 * `false`, `mousemove` never auto-reveals the bar; `toggleVisible`
	 * (PowerPoint's Ctrl+H) still works.
	 */
	readonly popupToolbarEnabled = input<boolean>(true);

	/** Step the show by one slide (`-1` back, `1` forward). */
	readonly move = output<1 | -1>();
	/** Leave the show. */
	readonly endPresentation = output<void>();
	/** Swap between the fullscreen show and presenter view. */
	readonly presenterViewToggle = output<void>();

	// ------------------------------------------------------------------
	// Injected state
	// ------------------------------------------------------------------

	protected readonly annotations = inject(PresentationAnnotationsService);
	/** Owns the blank-screen state the Blackboard toggle drives. */
	private readonly presenterWindow = inject(PresenterWindowService);
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	/** Template constants (class tokens, palettes, helper fns). */
	protected readonly ui = PRESENT_TOOLBAR_VIEW;

	// ------------------------------------------------------------------
	// Derived state
	// ------------------------------------------------------------------

	protected readonly openPalette = signal<OpenPalette>('none');
	/**
	 * Whether the bar is faded in. Public because PowerPoint's Ctrl+H toggles it
	 * from the show's key handler, which owns no visibility state of its own:
	 * auto-hide and the shortcut have to drive ONE flag or the bar disagrees with
	 * itself the moment the presenter moves the mouse.
	 */
	readonly visible = signal(false);

	private readonly mountedAt = Date.now();
	private readonly now = signal(Date.now());

	protected readonly counterLabel = computed(() =>
		formatSlideCounter(this.currentSlideIndex(), this.totalSlides()),
	);
	// `elapsedSince` clamps a start time in the future to zero before formatting.
	// The shared `formatElapsed` deliberately does not clamp (a negative duration
	// is meaningful to some callers), so the guard belongs here, at the point the
	// duration is derived from the wall clock.
	protected readonly elapsedLabel = computed(() =>
		formatElapsed(elapsedSince(this.presentationStartTime() ?? this.mountedAt, this.now())),
	);
	protected readonly atFirstSlide = computed(() => isAtFirstSlide(this.currentSlideIndex()));
	protected readonly atLastSlide = computed(() =>
		isAtLastSlide(this.currentSlideIndex(), this.totalSlides()),
	);
	protected readonly hasAnnotations = computed(
		() => this.annotations.annotationStrokes().length > 0,
	);
	/** Blackboard reads active only as the black screen + pen combination. */
	protected readonly blackboardActive = computed(() =>
		isBlackboardActive(this.presenterWindow.snapshot().blackout, this.annotations.tool()),
	);

	private readonly autoHide = new PresentToolbarAutoHide((value) => {
		this.visible.set(value);
	});

	constructor() {
		const tick = setInterval(() => {
			this.now.set(Date.now());
		}, 1000);
		inject(DestroyRef).onDestroy(() => {
			clearInterval(tick);
			this.autoHide.dispose();
		});
	}

	// ------------------------------------------------------------------
	// Auto-hide
	// ------------------------------------------------------------------

	/**
	 * Mirrors React's `PresentationToolbarWrapper`: the shared bottom-trigger
	 * zone is tested against the show surface first, then any other movement
	 * shows the bar too. Both arms re-arm the countdown, so a presenter who
	 * stops moving loses the chrome after three seconds and gets it straight
	 * back on the next twitch.
	 */
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
		this.autoHide.poke();
	}

	/** PowerPoint's Ctrl+H: flip the show chrome, auto-hide countdown and all. */
	toggleVisible(): void {
		this.visible.update((shown) => !shown);
	}

	protected onMouseEnter(): void {
		this.autoHide.enter();
	}

	protected onMouseLeave(): void {
		this.autoHide.leave();
	}

	/** A press outside the bar dismisses whichever colour palette is open. */
	@HostListener('document:mousedown', ['$event'])
	protected onDocumentMouseDown(event: MouseEvent): void {
		const target = event.target;
		if (target instanceof Node && !this.host.nativeElement.contains(target)) {
			this.openPalette.set('none');
		}
	}

	// ------------------------------------------------------------------
	// Controls
	// ------------------------------------------------------------------

	/**
	 * Every control is bound for both `click` and `touchend`, and both stop
	 * propagation: the show surface advances the deck on click, so a press on
	 * the bar that bubbled would also skip a slide. The touch path additionally
	 * suppresses the synthesized click so one tap does not fire twice.
	 */
	protected onControlClick(event: MouseEvent, action: PresentToolbarAction): void {
		event.stopPropagation();
		this.run(action);
	}

	protected onControlTouch(event: TouchEvent, action: PresentToolbarAction): void {
		event.stopPropagation();
		event.preventDefault();
		this.run(action);
	}

	/** Pick a swatch. Choosing a colour also arms the tool it belongs to. */
	protected pickColor(event: Event, kind: 'pen' | 'highlighter', color: string): void {
		event.stopPropagation();
		event.preventDefault();
		if (kind === 'pen') {
			this.annotations.setPenColor(color);
		} else {
			this.annotations.setHighlighterColor(color);
		}
		this.openPalette.set('none');
		if (this.annotations.tool() !== kind) {
			this.annotations.setTool(kind);
		}
	}

	private run(action: PresentToolbarAction): void {
		switch (action) {
			case 'previous':
				this.move.emit(-1);
				return;
			case 'next':
				this.move.emit(1);
				return;
			case 'pen-color':
			case 'highlighter-color':
				this.togglePalette(action === 'pen-color' ? 'pen' : 'highlighter');
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
			case 'presenter-view':
				this.presenterViewToggle.emit();
				return;
			case 'end':
				this.endPresentation.emit();
				return;
			default:
				this.selectTool(action);
		}
	}

	private selectTool(tool: PresentationTool): void {
		this.annotations.setTool(tool);
		this.openPalette.set('none');
	}

	private togglePalette(kind: 'pen' | 'highlighter'): void {
		this.openPalette.update((open) => (open === kind ? 'none' : kind));
	}
}
