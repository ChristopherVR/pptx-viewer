/**
 * modal-dialog.component.ts: Reusable, accessible modal dialog shell.
 *
 * Selector: `pptx-modal-dialog`
 *
 * Angular counterpart of the Vue `ModalDialog.vue` and the React package's
 * ad-hoc dialog shells. Renders a full-screen backdrop plus a centered panel
 * with a header (title + close `×`), a default content area for the body, and
 * a footer area for action buttons. The other dialogs compose it.
 *
 * Behaviour:
 *  - The host owns the `open` flag; the component is purely presentational.
 *  - Emits `close` on the `×` button, on a backdrop click, and on `Escape`.
 *  - Body and footer are projected via `<ng-content>`. The footer slot uses a
 *    `[footer]` attribute selector so it can be omitted (no footer bar then).
 *
 * Usage:
 * ```html
 * <pptx-modal-dialog [open]="show()" title="Hyperlink" (close)="show.set(false)">
 *   <div>…body…</div>
 *   <div footer>
 *     <button>Cancel</button>
 *   </div>
 * </pptx-modal-dialog>
 * ```
 */

import {
	ChangeDetectionStrategy,
	Component,
	HostListener,
	input,
	output,
	signal,
} from '@angular/core';

@Component({
	selector: 'pptx-modal-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (open()) {
			<div class="pptx-ng-modal-backdrop" (click)="onBackdropClick()">
				<div
					class="pptx-ng-modal-panel"
					role="dialog"
					aria-modal="true"
					[attr.aria-label]="title() || null"
					[style.transform]="dragY() > 0 ? 'translateY(' + dragY() + 'px)' : null"
					[style.transition]="dragging() ? 'none' : 'transform 150ms ease-out'"
					(click)="$event.stopPropagation()"
				>
					<header
						class="pptx-ng-modal-header"
						(pointerdown)="onHeaderPointerDown($event)"
						(pointermove)="onHeaderPointerMove($event)"
						(pointerup)="onHeaderPointerUp($event)"
						(pointercancel)="onHeaderPointerUp($event)"
					>
						@if (title()) {
							<h2 class="pptx-ng-modal-title">{{ title() }}</h2>
						} @else {
							<span></span>
						}
						<button
							type="button"
							class="pptx-ng-modal-close"
							aria-label="Close"
							(click)="requestClose()"
						>
							&times;
						</button>
					</header>

					<div class="pptx-ng-modal-body">
						<ng-content />
					</div>

					<footer class="pptx-ng-modal-footer">
						<ng-content select="[footer]" />
					</footer>
				</div>
			</div>
		}
	`,
	styles: [
		`
			.pptx-ng-modal-backdrop {
				position: fixed;
				inset: 0;
				z-index: 1000;
				display: flex;
				align-items: center;
				justify-content: center;
				background: rgba(0, 0, 0, 0.45);
			}

			.pptx-ng-modal-panel {
				display: flex;
				flex-direction: column;
				min-width: 320px;
				max-width: min(92vw, 480px);
				max-height: 88vh;
				overflow: hidden;
				background: var(--pptx-popover, #ffffff);
				color: var(--pptx-foreground, #111827);
				border: 1px solid var(--pptx-border, #e5e7eb);
				border-radius: var(--pptx-radius, 8px);
				box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
			}

			.pptx-ng-modal-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
				padding: 12px 16px;
				border-bottom: 1px solid var(--pptx-border, #e5e7eb);
				/* Lets touch users swipe the header down to dismiss without the
				   browser hijacking the gesture for scrolling. */
				touch-action: none;
			}

			.pptx-ng-modal-title {
				margin: 0;
				font-size: 14px;
				font-weight: 600;
				line-height: 1.4;
			}

			.pptx-ng-modal-close {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 24px;
				height: 24px;
				padding: 0;
				font-size: 18px;
				line-height: 1;
				color: var(--pptx-muted-foreground, #6b7280);
				background: transparent;
				border: none;
				border-radius: 4px;
				cursor: pointer;
			}

			.pptx-ng-modal-close:hover {
				color: var(--pptx-foreground, #111827);
				background: var(--pptx-muted, #f3f4f6);
			}

			.pptx-ng-modal-body {
				padding: 16px;
				overflow-y: auto;
			}

			.pptx-ng-modal-footer {
				display: flex;
				justify-content: flex-end;
				gap: 8px;
				padding: 12px 16px;
				border-top: 1px solid var(--pptx-border, #e5e7eb);
			}

			/* Hide the footer bar entirely when nothing is projected into it. */
			.pptx-ng-modal-footer:empty {
				display: none;
			}

			/*
			 * Mobile: dock the panel full-width at the bottom as a bottom sheet
			 * (rounded top, dvh-capped height with internal scroll, safe-area
			 * padding). The backdrop stops centering so the panel can pin itself
			 * to the bottom edge. Desktop keeps the centered card above.
			 */
			@media (max-width: 640px), (pointer: coarse) {
				.pptx-ng-modal-backdrop {
					align-items: flex-end;
					justify-content: stretch;
				}

				.pptx-ng-modal-panel {
					min-width: 0;
					max-width: none;
					width: 100%;
					max-height: 88dvh;
					border-left: none;
					border-right: none;
					border-bottom: none;
					border-top-left-radius: 16px;
					border-top-right-radius: 16px;
					border-bottom-left-radius: 0;
					border-bottom-right-radius: 0;
					padding-bottom: max(env(safe-area-inset-bottom), 0px);
				}
			}
		`,
	],
})
export class ModalDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Optional heading shown in the header bar. */
	readonly title = input<string>('');

	/** Fired on backdrop click, the `×` button, and `Escape`. */
	readonly close = output<void>();

	/** Close on `Escape`, regardless of where focus currently sits. */
	@HostListener('document:keydown', ['$event'])
	onDocumentKeydown(event: KeyboardEvent): void {
		if (!this.open()) {
			return;
		}
		if (event.key === 'Escape') {
			event.stopPropagation();
			this.requestClose();
		}
	}

	requestClose(): void {
		this.close.emit();
	}

	/**
	 * Backdrop clicks close the dialog; clicks bubbling up from the panel are
	 * stopped in the template, so this only ever fires for the backdrop itself.
	 */
	onBackdropClick(): void {
		this.requestClose();
	}

	// ── Swipe-down-to-dismiss (touch/pen only) ─────────────────────────────────
	/** Live downward drag offset for the panel (px; 0 when idle). */
	readonly dragY = signal(0);
	/** True while a header drag is in progress (suppresses the snap-back transition). */
	readonly dragging = signal(false);
	private dragStartY: number | null = null;

	onHeaderPointerDown(event: PointerEvent): void {
		// Touch/pen only, and never from the × button or a form control, so a
		// desktop mouse and header clicks are entirely unaffected.
		if (event.pointerType === 'mouse') {
			return;
		}
		if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) {
			return;
		}
		this.dragStartY = event.clientY;
		this.dragging.set(true);
		(event.target as HTMLElement).setPointerCapture?.(event.pointerId);
	}

	onHeaderPointerMove(event: PointerEvent): void {
		if (this.dragStartY === null) {
			return;
		}
		this.dragY.set(Math.max(0, event.clientY - this.dragStartY));
	}

	onHeaderPointerUp(event: PointerEvent): void {
		if (this.dragStartY === null) {
			return;
		}
		const delta = event.clientY - this.dragStartY;
		this.dragStartY = null;
		this.dragging.set(false);
		(event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
		// 120 px matches the mobile-sheet DISMISS_THRESHOLD for consistency.
		if (delta > 120) {
			this.requestClose();
		}
		this.dragY.set(0);
	}
}
