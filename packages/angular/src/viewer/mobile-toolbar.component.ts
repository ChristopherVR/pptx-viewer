/**
 * mobile-toolbar.component.ts — Compact mobile top toolbar.
 *
 * Ported from: packages/react/src/viewer/components/mobile/MobileToolbar.tsx
 *
 * A single compact row that replaces the desktop ribbon below the 768px
 * breakpoint. Renders the essential always-available controls:
 *
 *   Menu · Undo · Redo · [spacer] · Present
 *
 * Section-specific functionality (Insert/Design/Export/etc.) lives in the
 * `MobileMenuSheetComponent` that opens from the Menu button; per-selection
 * actions live in the `MobileBottomBarComponent` at the bottom of the screen.
 *
 * The host renders a `role="toolbar"` with `aria-label="Toolbar"` so it matches
 * the framework-neutral accessibility contract the e2e specs assert against
 * (`getByRole('toolbar', { name: 'Toolbar' })`).
 *
 * Inputs
 *   canUndo    — whether the undo action is available
 *   canRedo    — whether the redo action is available
 *   canPresent — whether the Present action should be enabled
 *   canEdit    — whether editor-only controls (menu/undo/redo) should render
 *   menuOpen   — whether the mobile menu sheet is currently open
 *
 * Outputs
 *   toggleMenu — user tapped the Menu (hamburger) button
 *   undo       — user tapped Undo
 *   redo       — user tapped Redo
 *   present    — user tapped Present
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
	selector: 'pptx-mobile-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-mtoolbar" role="toolbar" aria-label="Toolbar">
			@if (canEdit()) {
				<button
					type="button"
					class="pptx-ng-mtoolbar-btn"
					[class.is-active]="menuOpen()"
					[attr.aria-pressed]="menuOpen() ? true : null"
					aria-label="Menu"
					title="Menu"
					(click)="toggleMenu.emit()"
				>
					<svg
						class="pptx-ng-mtoolbar-icon"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M3 12h18 M3 6h18 M3 18h18" />
					</svg>
				</button>

				<button
					type="button"
					class="pptx-ng-mtoolbar-btn"
					aria-label="Undo"
					title="Undo"
					[disabled]="!canUndo()"
					(click)="undo.emit()"
				>
					<svg
						class="pptx-ng-mtoolbar-icon"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M3 7v6h6 M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
					</svg>
				</button>

				<button
					type="button"
					class="pptx-ng-mtoolbar-btn"
					aria-label="Redo"
					title="Redo"
					[disabled]="!canRedo()"
					(click)="redo.emit()"
				>
					<svg
						class="pptx-ng-mtoolbar-icon"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M21 7v6h-6 M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
					</svg>
				</button>
			}

			<div class="pptx-ng-mtoolbar-spacer"></div>

			<button
				type="button"
				class="pptx-ng-mtoolbar-btn pptx-ng-mtoolbar-present"
				aria-label="Present"
				title="Present"
				[disabled]="!canPresent()"
				(click)="present.emit()"
			>
				<svg
					class="pptx-ng-mtoolbar-icon"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M5 3l14 9-14 9V3z" />
				</svg>
			</button>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
			}

			.pptx-ng-mtoolbar {
				position: relative;
				z-index: 20;
				display: flex;
				align-items: center;
				gap: 0.25rem;
				padding: 0.25rem 0.5rem;
				min-height: 52px;
				background: rgba(26, 26, 26, 0.92);
				border-bottom: 1px solid rgba(255, 255, 255, 0.1);
				backdrop-filter: blur(12px);
				-webkit-backdrop-filter: blur(12px);
				padding-top: max(env(safe-area-inset-top, 0px), 0.25rem);
			}

			.pptx-ng-mtoolbar-spacer {
				flex: 1 1 auto;
			}

			.pptx-ng-mtoolbar-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 44px;
				min-height: 44px;
				border: none;
				border-radius: 0.375rem;
				background: transparent;
				color: rgba(255, 255, 255, 0.85);
				cursor: pointer;
				touch-action: manipulation;
				transition:
					background 0.12s,
					transform 0.08s;
				-webkit-tap-highlight-color: transparent;
			}

			.pptx-ng-mtoolbar-btn:active:not([disabled]) {
				transform: scale(0.92);
			}

			.pptx-ng-mtoolbar-btn:hover:not([disabled]) {
				background: rgba(255, 255, 255, 0.08);
			}

			.pptx-ng-mtoolbar-btn.is-active {
				color: #3b82f6;
			}

			.pptx-ng-mtoolbar-btn[disabled] {
				opacity: 0.35;
				cursor: not-allowed;
			}

			.pptx-ng-mtoolbar-present {
				color: #3b82f6;
			}

			.pptx-ng-mtoolbar-icon {
				width: 1.25rem;
				height: 1.25rem;
				flex-shrink: 0;
			}
		`,
	],
})
export class MobileToolbarComponent {
	/** Whether the undo action is available. */
	readonly canUndo = input<boolean>(false);
	/** Whether the redo action is available. */
	readonly canRedo = input<boolean>(false);
	/** Whether the Present action should be available. */
	readonly canPresent = input<boolean>(true);
	/** Whether editor-only controls (menu / undo / redo) should render. */
	readonly canEdit = input<boolean>(false);
	/** Whether the mobile-menu sheet is currently open (highlights the button). */
	readonly menuOpen = input<boolean>(false);

	/** User tapped the Menu (hamburger) button. */
	readonly toggleMenu = output<void>();
	/** User tapped Undo. */
	readonly undo = output<void>();
	/** User tapped Redo. */
	readonly redo = output<void>();
	/** User tapped Present. */
	readonly present = output<void>();
}
