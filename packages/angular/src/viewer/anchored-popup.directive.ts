import { AfterViewInit, Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import { computeAnchoredPopupPosition } from 'pptx-viewer-shared';

/**
 * `[pptxAnchoredPopup]` - pins a ribbon dropdown/popover to its trigger with
 * `position: fixed`, so it escapes the ribbon content row's `overflow-x: auto`
 * clip (the horizontal scroll container otherwise crops any
 * `position: absolute` popup to the row's own height, or the popup's layout
 * pushes the row wide instead - issue #183). Mirrors React's `RibbonMenu`,
 * the Vue binding's `vAnchoredPopup` directive, and the Svelte binding's
 * `anchoredPopup` action; the geometry itself comes from the shared,
 * framework-agnostic `computeAnchoredPopupPosition`.
 *
 * Coordinates re-sync on init, on the anchor's `mouseenter` (these popovers
 * are shown via CSS `:hover`, not a component-owned open flag), on any scroll
 * (capture phase, so ancestor scrolls count), and on window resize.
 */
@Directive({
	selector: '[pptxAnchoredPopup]',
	standalone: true,
})
export class AnchoredPopupDirective implements AfterViewInit, OnDestroy {
	private readonly host = inject(ElementRef<HTMLElement>).nativeElement;

	/** The trigger element this popup hangs below (its left/right/bottom edges are tracked). */
	readonly pptxAnchoredPopup = input<HTMLElement | null>(null);
	/** Align the popup's right edge to the anchor's right edge instead of left. */
	readonly pptxAnchoredPopupAlignRight = input<boolean>(false);

	private readonly update = (): void => {
		const anchor = this.pptxAnchoredPopup();
		if (!anchor) {
			return;
		}
		const { top, left, right } = computeAnchoredPopupPosition(anchor.getBoundingClientRect(), {
			alignRight: this.pptxAnchoredPopupAlignRight(),
		});
		this.host.style.position = 'fixed';
		this.host.style.margin = '0';
		this.host.style.top = `${top}px`;
		this.host.style.left = left === null ? 'auto' : `${left}px`;
		this.host.style.right = right === null ? 'auto' : `${right}px`;
	};

	ngAfterViewInit(): void {
		this.update();
		this.pptxAnchoredPopup()?.addEventListener('mouseenter', this.update);
		window.addEventListener('resize', this.update);
		document.addEventListener('scroll', this.update, true);
	}

	ngOnDestroy(): void {
		this.pptxAnchoredPopup()?.removeEventListener('mouseenter', this.update);
		window.removeEventListener('resize', this.update);
		document.removeEventListener('scroll', this.update, true);
	}
}
