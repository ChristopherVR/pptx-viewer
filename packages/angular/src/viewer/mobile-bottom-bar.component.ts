/**
 * mobile-bottom-bar.component.ts — Persistent mobile bottom navigation bar.
 *
 * Ported from: packages/react/src/viewer/components/mobile/MobileBottomBar.tsx
 *
 * A fixed-to-bottom bar exposing five primary actions for mobile viewers:
 *   Prev · Slide counter · Next · Sorter · Present · Menu
 *
 * The Angular version targets the viewer-first scope (no editor): the actions
 * mirror `goPrev`, `goNext`, `present`, `openSorter`, `openFind`, `openMenu`
 * (which in turn opens the `MobileMenuSheetComponent`).
 *
 * Unlike the React version (which targets the full editor and uses inspector /
 * comments / notes as the five slots), this component exposes navigation
 * primitives that the orchestrator (`PowerPointViewerComponent`) already has
 * concrete handler methods for.
 *
 * Inputs
 *   activeIndex   — zero-based index of the current slide
 *   slideCount    — total number of slides
 *   canPresent    — whether the Present action should be enabled
 *   menuOpen      — whether the mobile menu sheet is currently open
 *
 * Outputs
 *   prev          — user tapped the previous-slide button
 *   next          — user tapped the next-slide button
 *   present       — user tapped the Present button
 *   openSorter    — user tapped the Sorter button
 *   openFind      — user tapped the Find button
 *   openSlides    — user tapped the Slides thumbnail button
 *   toggleMenu    — user tapped the menu (⋯) button
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Internal action descriptor used to build the bar. */
interface BarAction {
	key: string;
	label: string;
	/** SVG path data for the icon (24 × 24 view-box). */
	svgPath: string;
	disabled: boolean;
	active?: boolean;
	badge?: number;
	emit: () => void;
}

@Component({
	selector: 'pptx-mobile-bottom-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<nav class="pptx-ng-mbar" aria-label="Mobile navigation">
			@for (action of actions(); track action.key) {
				<button
					type="button"
					class="pptx-ng-mbar-btn"
					[class.is-active]="action.active"
					[attr.aria-pressed]="action.active ? true : null"
					[attr.aria-label]="action.label"
					[disabled]="action.disabled"
					(click)="action.emit()"
				>
					<svg
						class="pptx-ng-mbar-icon"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path [attr.d]="action.svgPath" />
					</svg>
					<span class="pptx-ng-mbar-label">{{ action.label }}</span>
					@if (action.badge && action.badge > 0) {
						<span class="pptx-ng-mbar-badge" aria-hidden="true">
							{{ action.badge > 99 ? '99+' : action.badge }}
						</span>
					}
					@if (action.active) {
						<span class="pptx-ng-mbar-indicator" aria-hidden="true"></span>
					}
				</button>
			}
		</nav>
	`,
	styles: [
		`
			:host {
				display: block;
			}

			/* ── Navigation bar ── */

			.pptx-ng-mbar {
				display: flex;
				align-items: stretch;
				justify-content: space-around;
				background: rgba(26, 26, 26, 0.92);
				border-top: 1px solid rgba(255, 255, 255, 0.1);
				backdrop-filter: blur(12px);
				-webkit-backdrop-filter: blur(12px);
				padding-bottom: max(env(safe-area-inset-bottom, 0px), 0px);
			}

			/* ── Individual button ── */

			.pptx-ng-mbar-btn {
				position: relative;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 0.125rem;
				flex: 1;
				min-height: 56px;
				padding: 0.375rem 0.25rem;
				border: none;
				background: transparent;
				color: rgba(255, 255, 255, 0.55);
				font-size: 0.625rem;
				font-weight: 500;
				cursor: pointer;
				touch-action: manipulation;
				transition:
					color 0.12s,
					transform 0.08s;
				-webkit-tap-highlight-color: transparent;
			}

			.pptx-ng-mbar-btn:active:not([disabled]) {
				transform: scale(0.92);
			}

			.pptx-ng-mbar-btn.is-active {
				color: #3b82f6;
			}

			.pptx-ng-mbar-btn:hover:not([disabled]):not(.is-active) {
				color: #e5e5e5;
			}

			.pptx-ng-mbar-btn[disabled] {
				opacity: 0.35;
				cursor: not-allowed;
			}

			/* ── Icon ── */

			.pptx-ng-mbar-icon {
				width: 1.25rem;
				height: 1.25rem;
				flex-shrink: 0;
			}

			/* ── Label ── */

			.pptx-ng-mbar-label {
				line-height: 1;
				white-space: nowrap;
			}

			/* ── Badge (numeric count) ── */

			.pptx-ng-mbar-badge {
				position: absolute;
				top: 0.25rem;
				right: calc(50% - 1.25rem);
				display: flex;
				align-items: center;
				justify-content: center;
				min-width: 1rem;
				height: 1rem;
				padding: 0 0.25rem;
				border-radius: 9999px;
				background: #ef4444;
				color: #fff;
				font-size: 0.5625rem;
				font-weight: 600;
				line-height: 1;
			}

			/* ── Active indicator stripe ── */

			.pptx-ng-mbar-indicator {
				position: absolute;
				top: 0;
				left: 50%;
				transform: translateX(-50%);
				width: 2rem;
				height: 0.1875rem;
				border-radius: 9999px;
				background: #3b82f6;
			}
		`,
	],
})
export class MobileBottomBarComponent {
	// ── Inputs ────────────────────────────────────────────────────────────────

	/** Zero-based index of the currently displayed slide. */
	readonly activeIndex = input<number>(0);

	/** Total number of slides in the presentation. */
	readonly slideCount = input<number>(0);

	/** Whether the "Present" action should be available. */
	readonly canPresent = input<boolean>(true);

	/** Whether the mobile-menu sheet is currently open (highlights the button). */
	readonly menuOpen = input<boolean>(false);

	/** Whether the slides thumbnail sheet is currently open. */
	readonly slidesOpen = input<boolean>(false);

	// ── Outputs ───────────────────────────────────────────────────────────────

	/** User tapped the previous-slide button. */
	readonly prev = output<void>();
	/** User tapped the next-slide button. */
	readonly next = output<void>();
	/** User tapped the Present button. */
	readonly present = output<void>();
	/** User tapped the Slide Sorter button. */
	readonly openSorter = output<void>();
	/** User tapped the Find button. */
	readonly openFind = output<void>();
	/** User tapped the Slides thumbnail strip button. */
	readonly openSlides = output<void>();
	/** User tapped the menu (⋯) button. */
	readonly toggleMenu = output<void>();

	// ── Derived action list ───────────────────────────────────────────────────

	readonly actions = computed<BarAction[]>(() => {
		const idx = this.activeIndex();
		const count = this.slideCount();
		return [
			{
				key: 'prev',
				label: 'Prev',
				// Chevron-left
				svgPath: 'M15 18l-6-6 6-6',
				disabled: idx <= 0,
				emit: () => this.prev.emit(),
			},
			{
				key: 'slides',
				label: 'Slides',
				// Layers icon
				svgPath: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
				disabled: count === 0,
				active: this.slidesOpen(),
				emit: () => this.openSlides.emit(),
			},
			{
				key: 'find',
				label: 'Find',
				// Search icon
				svgPath: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
				disabled: count === 0,
				emit: () => this.openFind.emit(),
			},
			{
				key: 'present',
				label: 'Present',
				// Play icon
				svgPath: 'M5 3l14 9-14 9V3z',
				disabled: !this.canPresent() || count === 0,
				emit: () => this.present.emit(),
			},
			{
				key: 'menu',
				label: 'More',
				// More-horizontal (⋯)
				svgPath: 'M5 12h.01M12 12h.01M19 12h.01',
				disabled: false,
				active: this.menuOpen(),
				emit: () => this.toggleMenu.emit(),
			},
			{
				key: 'next',
				label: 'Next',
				// Chevron-right
				svgPath: 'M9 18l6-6-6-6',
				disabled: idx >= count - 1,
				emit: () => this.next.emit(),
			},
		];
	});
}
