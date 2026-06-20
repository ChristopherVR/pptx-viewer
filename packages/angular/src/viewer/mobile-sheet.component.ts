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
	computed,
	HostListener,
	input,
	output,
	signal,
} from '@angular/core';

/** Drag-down distance in pixels that triggers dismissal. */
const DISMISS_THRESHOLD = 120;

@Component({
	selector: 'pptx-mobile-sheet',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		@if (open()) {
			<div
				class="pptx-ng-msheet-root"
				role="dialog"
				aria-modal="true"
				[attr.aria-label]="title() || 'Sheet'"
			>
				<!-- Backdrop -->
				<button
					type="button"
					class="pptx-ng-msheet-backdrop"
					aria-label="Close"
					(click)="closed.emit()"
				></button>

				<!-- Panel -->
				<div class="pptx-ng-msheet-panel" [ngStyle]="panelStyle()">
					<!--
						Drag handle + header form a single swipe-to-dismiss grab
						region so the gesture isn't limited to the thin pill.
					-->
					<div
						class="pptx-ng-msheet-grab"
						(pointerdown)="onPointerDown($event)"
						(pointermove)="onPointerMove($event)"
						(pointerup)="onPointerUp($event)"
						(pointercancel)="onPointerUp($event)"
					>
						<div class="pptx-ng-msheet-handle-row">
							<div class="pptx-ng-msheet-handle"></div>
						</div>

						<!-- Header -->
						@if (title()) {
							<div class="pptx-ng-msheet-header">
								<span class="pptx-ng-msheet-title">{{ title() }}</span>
							</div>
						}
					</div>

					<!-- Body -->
					<div class="pptx-ng-msheet-body">
						<ng-content />
					</div>
				</div>
			</div>
		}
	`,
	styles: [
		`
			:host {
				display: contents;
			}

			/* ── Root overlay ── */

			.pptx-ng-msheet-root {
				position: fixed;
				inset: 0;
				z-index: 60;
				display: flex;
				flex-direction: column;
				justify-content: flex-end;
			}

			/* ── Backdrop ── */

			.pptx-ng-msheet-backdrop {
				position: absolute;
				inset: 0;
				background: rgba(0, 0, 0, 0.45);
				backdrop-filter: blur(2px);
				border: none;
				cursor: pointer;
				/* Animate in */
				animation: pptx-msheet-fade-in 150ms ease both;
			}

			@keyframes pptx-msheet-fade-in {
				from {
					opacity: 0;
				}
				to {
					opacity: 1;
				}
			}

			/* ── Panel ── */

			.pptx-ng-msheet-panel {
				position: relative;
				display: flex;
				flex-direction: column;
				background: #1a1a1a;
				color: #e5e5e5;
				border-top: 1px solid rgba(255, 255, 255, 0.1);
				border-radius: 1rem 1rem 0 0;
				box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
				overflow: hidden;
				/* Animate in */
				animation: pptx-msheet-slide-up 200ms cubic-bezier(0.32, 0.72, 0, 1) both;
			}

			@keyframes pptx-msheet-slide-up {
				from {
					transform: translateY(100%);
				}
				to {
					transform: translateY(0);
				}
			}

			/* ── Drag handle row ── */

			.pptx-ng-msheet-grab {
				cursor: grab;
				touch-action: none;
				flex-shrink: 0;
			}

			.pptx-ng-msheet-grab:active {
				cursor: grabbing;
			}

			.pptx-ng-msheet-handle-row {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 0.5rem 0 0.25rem;
			}

			.pptx-ng-msheet-handle {
				width: 2.5rem;
				height: 0.25rem;
				border-radius: 9999px;
				background: rgba(255, 255, 255, 0.3);
			}

			/* ── Header ── */

			.pptx-ng-msheet-header {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0 1rem 0.625rem;
				border-bottom: 1px solid rgba(255, 255, 255, 0.08);
				flex-shrink: 0;
			}

			.pptx-ng-msheet-title {
				font-size: 0.875rem;
				font-weight: 600;
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			/* ── Scrollable body ── */

			.pptx-ng-msheet-body {
				flex: 1;
				overflow-y: auto;
				overscroll-behavior: contain;
			}
		`,
	],
})
export class MobileSheetComponent {
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

	// ── Keyboard ─────────────────────────────────────────────────────────────

	@HostListener('document:keydown', ['$event'])
	onDocumentKeydown(event: KeyboardEvent): void {
		if (this.open() && event.key === 'Escape') {
			event.preventDefault();
			this.closed.emit();
		}
	}

	// ── Pointer events (drag-to-dismiss) ─────────────────────────────────────

	onPointerDown(event: PointerEvent): void {
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
