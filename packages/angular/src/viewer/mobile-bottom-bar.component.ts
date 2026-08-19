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
 * Icons and colours come from the same Lucide glyphs and `--pptx-*` theme
 * tokens React uses. Each input/output is documented on its declaration below.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
	LucideLayers,
	LucideMessageSquare,
	LucidePlus,
	LucideSettings2,
	LucideStickyNote,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { buildBarActions } from './mobile-chrome-helpers';

/** Which mobile sheet/panel is currently active (highlights its button). */
export type MobileBarSheet = 'slides' | 'inspector' | 'comments' | 'notes' | null;

/** Internal action descriptor used to build the bar. */
interface BarAction {
	key: NonNullable<MobileBarSheet> | 'insert';
	labelKey: string;
	ariaLabelKey?: string;
	disabled: boolean;
	active: boolean;
	badge?: number;
	emit: () => void;
}

@Component({
	selector: 'pptx-mobile-bottom-bar',
	standalone: true,
	imports: [
		LucideLayers,
		LucideMessageSquare,
		LucidePlus,
		LucideSettings2,
		LucideStickyNote,
		TranslatePipe,
	],
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
					@switch (action.key) {
						@case ('slides') {
							<svg lucideLayers class="pptx-ng-mbar-icon" aria-hidden="true"></svg>
						}
						@case ('insert') {
							<svg lucidePlus class="pptx-ng-mbar-icon" aria-hidden="true"></svg>
						}
						@case ('inspector') {
							<svg lucideSettings2 class="pptx-ng-mbar-icon" aria-hidden="true"></svg>
						}
						@case ('comments') {
							<svg lucideMessageSquare class="pptx-ng-mbar-icon" aria-hidden="true"></svg>
						}
						@case ('notes') {
							<svg lucideStickyNote class="pptx-ng-mbar-icon" aria-hidden="true"></svg>
						}
					}
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

			/*
			 * Themed chrome: the same semantic tokens React's MobileBottomBar
			 * resolves through Tailwind (bg-secondary/80, dropping to /60 when
			 * backdrop-filter is supported, plus border-border), so a ViewerTheme
			 * preset restyles the bar instead of leaving it on a hardcoded
			 * near-black that clashes with the rest of the chrome.
			 */
			.pptx-ng-mbar {
				display: flex;
				align-items: stretch;
				justify-content: space-around;
				background: color-mix(in srgb, var(--pptx-secondary, #1f2937) 80%, transparent);
				border-top: 1px solid var(--pptx-border, #374151);
				padding-bottom: max(env(safe-area-inset-bottom, 0px), 0px);
			}

			@supports ((backdrop-filter: blur(12px)) or (-webkit-backdrop-filter: blur(12px))) {
				.pptx-ng-mbar {
					background: color-mix(in srgb, var(--pptx-secondary, #1f2937) 60%, transparent);
					backdrop-filter: blur(12px);
					-webkit-backdrop-filter: blur(12px);
				}
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
				color: var(--pptx-muted-foreground, #9ca3af);
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
				color: var(--pptx-primary, #6366f1);
			}

			.pptx-ng-mbar-btn:hover:not([disabled]):not(.is-active) {
				color: var(--pptx-foreground, #f3f4f6);
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
				background: var(--pptx-primary, #6366f1);
				color: var(--pptx-primary-foreground, #ffffff);
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
				background: var(--pptx-primary, #6366f1);
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

	// Shared `buildBarActions` decides which slots are disabled (no slides
	// loaded); this binding only maps the resulting descriptor's `key` and
	// `disabled` onto its own labels, icons and outputs.
	readonly actions = computed<BarAction[]>(() => {
		const active = this.activeSheet(),
			disabledByKey = new Map(
				buildBarActions({ slideCount: this.slideCount() }).map((descriptor) => [
					descriptor.key,
					descriptor.disabled,
				]),
			);
		return [
			{
				key: 'slides',
				labelKey: 'pptx.sections.slides',
				disabled: disabledByKey.get('slides') ?? false,
				active: active === 'slides',
				emit: () => this.openSlides.emit(),
			},
			{
				key: 'insert',
				labelKey: 'pptx.editorToolbar.insert',
				disabled: disabledByKey.get('insert') ?? false,
				active: false,
				emit: () => this.insert.emit(),
			},
			{
				key: 'inspector',
				labelKey: 'pptx.arrange.format',
				disabled: disabledByKey.get('inspector') ?? false,
				active: active === 'inspector',
				emit: () => this.openFormat.emit(),
			},
			{
				key: 'comments',
				labelKey: 'pptx.toolbar.comments',
				disabled: disabledByKey.get('comments') ?? false,
				active: active === 'comments',
				badge: this.commentCount(),
				emit: () => this.openComments.emit(),
			},
			{
				key: 'notes',
				labelKey: 'pptx.notes.title',
				ariaLabelKey: 'pptx.statusBar.toggleNotes',
				disabled: disabledByKey.get('notes') ?? false,
				active: active === 'notes',
				emit: () => this.notes.emit(),
			},
		];
	});
}
