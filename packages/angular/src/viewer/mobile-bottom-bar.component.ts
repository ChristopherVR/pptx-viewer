/**
 * mobile-bottom-bar.component.ts: Persistent mobile bottom action bar.
 *
 * Ported from: packages/react/src/viewer/components/mobile/MobileBottomBar.tsx
 *
 * A fixed-to-bottom bar exposing the five primary per-selection / per-slide
 * actions for mobile editing, mirroring React's slot set:
 *
 *   Slides · Insert · Format · Comments · Notes
 *
 * Each slot either opens a bottom sheet/panel (slides / format / comments /
 * notes) or triggers an action (insert). The Menu, Undo/Redo and Present
 * controls live in the compact top toolbar (`MobileToolbarComponent`).
 *
 * The host renders a `<nav aria-label="Editor actions">` so it matches the
 * framework-neutral accessibility contract the e2e specs assert against
 * (`getByRole('navigation', { name: 'Editor actions' })`).
 *
 * Inputs
 *   slideCount    : total number of slides (gates Slides/Format/Insert)
 *   commentCount  : number of comments on the active slide (badge)
 *   activeSheet   : currently-active sheet, for highlighting the bar button
 *
 * Outputs
 *   openSlides    : user tapped the Slides button
 *   insert        : user tapped the Insert button
 *   openFormat    : user tapped the Format button
 *   openComments  : user tapped the Comments button
 *   notes         : user tapped the Notes button
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Which mobile sheet/panel is currently active (highlights its button). */
export type MobileBarSheet = 'slides' | 'inspector' | 'comments' | 'notes' | null;

/** Internal action descriptor used to build the bar. */
interface BarAction {
	key: NonNullable<MobileBarSheet> | 'insert';
	labelKey: string;
	ariaLabelKey?: string;
	/** SVG path data for the icon (24 × 24 view-box). */
	svgPath: string;
	disabled: boolean;
	active: boolean;
	badge?: number;
	emit: () => void;
}

@Component({
	selector: 'pptx-mobile-bottom-bar',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<nav class="pptx-ng-mbar" [attr.aria-label]="'pptx.mobileBar.ariaLabel' | translate">
			@for (action of actions(); track action.key) {
				<button
					type="button"
					class="pptx-ng-mbar-btn"
					[class.is-active]="action.active"
					[attr.aria-pressed]="action.active ? true : null"
					[attr.aria-label]="action.ariaLabelKey ?? action.labelKey | translate"
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
					<span class="pptx-ng-mbar-label">{{ action.labelKey | translate }}</span>
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

	/** Total number of slides in the presentation. */
	readonly slideCount = input<number>(0);

	/** Number of comments on the active slide (for the badge). */
	readonly commentCount = input<number>(0);

	/** Currently-active sheet/panel (highlights its button). */
	readonly activeSheet = input<MobileBarSheet>(null);

	// ── Outputs ───────────────────────────────────────────────────────────────

	/** User tapped the Slides thumbnail strip button. */
	readonly openSlides = output<void>();
	/** User tapped the Insert button. */
	readonly insert = output<void>();
	/** User tapped the Format (inspector) button. */
	readonly openFormat = output<void>();
	/** User tapped the Comments button. */
	readonly openComments = output<void>();
	/** User tapped the Notes button. */
	readonly notes = output<void>();

	// ── Derived action list ───────────────────────────────────────────────────

	readonly actions = computed<BarAction[]>(() => {
		const count = this.slideCount();
		const noSlides = count === 0;
		const active = this.activeSheet();
		return [
			{
				key: 'slides',
				labelKey: 'pptx.sections.slides',
				// Layers icon
				svgPath: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
				disabled: noSlides,
				active: active === 'slides',
				emit: () => this.openSlides.emit(),
			},
			{
				key: 'insert',
				labelKey: 'pptx.editorToolbar.insert',
				// Plus icon
				svgPath: 'M12 5v14 M5 12h14',
				disabled: noSlides,
				active: false,
				emit: () => this.insert.emit(),
			},
			{
				key: 'inspector',
				labelKey: 'pptx.arrange.format',
				// Sliders icon
				svgPath: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
				disabled: noSlides,
				active: active === 'inspector',
				emit: () => this.openFormat.emit(),
			},
			{
				key: 'comments',
				labelKey: 'pptx.toolbar.comments',
				// Message-square icon
				svgPath: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
				disabled: noSlides,
				active: active === 'comments',
				badge: this.commentCount(),
				emit: () => this.openComments.emit(),
			},
			{
				key: 'notes',
				labelKey: 'pptx.notes.title',
				ariaLabelKey: 'pptx.statusBar.toggleNotes',
				// Note / document-text icon
				svgPath:
					'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
				disabled: noSlides,
				active: active === 'notes',
				emit: () => this.notes.emit(),
			},
		];
	});
}
