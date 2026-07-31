/**
 * mobile-sheet.component.ts: Reusable slide-up bottom sheet for mobile.
 *
 * Ported from: packages/react/src/viewer/components/mobile/MobileSheet.tsx
 *
 * A fixed overlay with:
 *   - a semi-transparent backdrop (tap to close)
 *   - a rounded-top panel that slides up from the bottom
 *   - a drag handle: dragging down by > 120 px dismisses the sheet
 *   - Escape key closes the sheet
 *
 * Inputs
 *   open          : controls visibility
 *   title         : optional header text
 *   heightFraction : initial height as fraction of dvh (default 0.6)
 *   fullScreen    : when true, the sheet covers the full viewport height
 *
 * Outputs
 *   closed : emits when the user dismisses the sheet
 *
 * Content is projected via `<ng-content>`.
 */

import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { activateModalFocus } from '../internal/shared';

/** Drag-down distance in pixels that triggers dismissal. */
const DISMISS_THRESHOLD = 120;

@Component({
	selector: 'pptx-mobile-sheet',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, TranslatePipe],
	templateUrl: './mobile-sheet.component.html',
	styleUrl: './mobile-sheet.component.css',
})
export class MobileSheetComponent {
	private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
	private releaseFocus: (() => void) | undefined;
	/** Controls whether the sheet is visible. */
	readonly open = input<boolean>(false);

	/** Optional header text displayed above the body. */
	readonly title = input<string>('');

	/**
	 * Height of the sheet as a fraction of the viewport height (0–1).
	 * Ignored when `fullScreen` is true.
	 */
	readonly heightFraction = input<number>(0.6);

	/** When true, the sheet occupies the full viewport height. */
	readonly fullScreen = input<boolean>(false);

	/** Emits when the user closes the sheet (backdrop tap, swipe, or Escape). */
	readonly closed = output<void>();

	// ── Drag state ────────────────────────────────────────────────────────────

	private _dragStartY: number | null = null;
	private _dragPointerId: number | null = null;

	/** Current translateY applied during an active drag (px). */
	readonly dragY = signal<number>(0);

	/** Whether a drag is in progress (suppresses CSS transition during drag). */
	readonly isDragging = signal<boolean>(false);

	// ── Derived panel style ───────────────────────────────────────────────────

	readonly panelStyle = computed<Record<string, string>>(() => {
		const height = this.fullScreen()
			? 'calc(100dvh - env(safe-area-inset-top, 0px))'
			: `${Math.round(this.heightFraction() * 100)}dvh`;

		const dy = this.dragY();
		const transform = dy > 0 ? `translateY(${dy}px)` : '';
		const transition = this.isDragging() ? 'none' : 'transform 150ms ease-out';

		const style: Record<string, string> = { height };
		if (transform) {
			style['transform'] = transform;
		}
		style['transition'] = transition;
		return style;
	});

	constructor() {
		effect(() => {
			const open = this.open();
			const panel = this.panel()?.nativeElement;
			this.releaseFocus?.();
			this.releaseFocus =
				open && panel
					? activateModalFocus(panel, { onEscape: () => this.closed.emit() })
					: undefined;
		});
		inject(DestroyRef).onDestroy(() => this.releaseFocus?.());
	}

	// ── Pointer events (drag-to-dismiss) ─────────────────────────────────────

	onPointerDown(event: PointerEvent): void {
		if ((event.target as HTMLElement).closest('button')) {
			return;
		}
		this._dragStartY = event.clientY;
		this._dragPointerId = event.pointerId;
		this.isDragging.set(true);
		(event.target as HTMLElement).setPointerCapture(event.pointerId);
	}

	onPointerMove(event: PointerEvent): void {
		if (this._dragStartY === null || event.pointerId !== this._dragPointerId) {
			return;
		}
		const delta = event.clientY - this._dragStartY;
		this.dragY.set(Math.max(0, delta));
	}

	onPointerUp(event: PointerEvent): void {
		if (this._dragStartY === null || event.pointerId !== this._dragPointerId) {
			return;
		}
		const delta = event.clientY - this._dragStartY;
		this._dragStartY = null;
		this._dragPointerId = null;
		this.isDragging.set(false);
		this.dragY.set(0);

		if (delta > DISMISS_THRESHOLD) {
			this.closed.emit();
		}
	}
}
