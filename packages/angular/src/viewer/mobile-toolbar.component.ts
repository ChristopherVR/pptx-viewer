/**
 * mobile-toolbar.component.ts: Compact mobile top toolbar.
 *
 * Ported from: packages/react/src/viewer/components/mobile/MobileToolbar.tsx
 *
 * A single compact row that replaces the desktop ribbon below the 768px
 * breakpoint. Renders the essential always-available controls:
 *
 *   Menu · Undo · Redo · [spacer] · AI · Save · Present · Share
 *
 * The slot order, icons and colours mirror React's MobileToolbar exactly.
 *
 * Section-specific functionality (Insert/Design/Export/etc.) lives in the
 * `MobileMenuSheetComponent` that opens from the Menu button; per-selection
 * actions live in the `MobileBottomBarComponent` at the bottom of the screen.
 *
 * The host renders a `role="toolbar"` with `aria-label="Toolbar"` so it matches
 * the framework-neutral accessibility contract the e2e specs assert against
 * (`getByRole('toolbar', { name: 'Toolbar' })`).
 *
 * Each input/output is documented on its own declaration below.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
	LucideDownload,
	LucideMenu,
	LucidePresentation,
	LucideRedo,
	LucideShare2,
	LucideSparkles,
	LucideUndo,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import type { ToolbarActionId } from '../internal/shared';
import { toolbarVisibility } from './toolbar-visibility';

@Component({
	selector: 'pptx-mobile-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		LucideDownload,
		LucideMenu,
		LucidePresentation,
		LucideRedo,
		LucideShare2,
		LucideSparkles,
		LucideUndo,
		TranslatePipe,
	],
	template: `
		<div
			class="pptx-ng-mtoolbar"
			role="toolbar"
			[attr.aria-label]="'pptx.mobileToolbar.toolbar' | translate"
		>
			@if (canEdit()) {
				<button
					type="button"
					class="pptx-ng-mtoolbar-btn"
					[class.is-active]="menuOpen()"
					[attr.aria-pressed]="menuOpen() ? true : null"
					[attr.aria-label]="'pptx.mobileToolbar.menu' | translate"
					[title]="'pptx.mobileToolbar.menu' | translate"
					(click)="toggleMenu.emit()"
				>
					<svg lucideMenu class="pptx-ng-mtoolbar-icon" aria-hidden="true"></svg>
				</button>

				@if (!toolbar.isHidden('undo')) {
					<button
						type="button"
						class="pptx-ng-mtoolbar-btn"
						[attr.aria-label]="'pptx.toolbar.undo' | translate"
						[title]="'pptx.toolbar.undo' | translate"
						[disabled]="!canUndo()"
						(click)="undo.emit()"
					>
						<svg lucideUndo class="pptx-ng-mtoolbar-icon" aria-hidden="true"></svg>
					</button>
				}

				@if (!toolbar.isHidden('redo')) {
					<button
						type="button"
						class="pptx-ng-mtoolbar-btn"
						[attr.aria-label]="'pptx.toolbar.redo' | translate"
						[title]="'pptx.toolbar.redo' | translate"
						[disabled]="!canRedo()"
						(click)="redo.emit()"
					>
						<svg lucideRedo class="pptx-ng-mtoolbar-icon" aria-hidden="true"></svg>
					</button>
				}
			}

			<div class="pptx-ng-mtoolbar-spacer"></div>

			<!--
				AI assistant toggle: surfaced in the top-right on mobile too. The
				mobile toolbar replaces the desktop ribbon (which carries the AI
				toggle), so without this the assistant is unreachable on phones.
				Gated on the host opting in via the 'ai' config (aiEnabled) and on
				edit mode, mirroring the desktop ribbon.
			-->
			@if (canEdit() && aiEnabled()) {
				<button
					type="button"
					class="pptx-ng-mtoolbar-btn"
					[class.is-active]="aiPanelOpen()"
					[attr.aria-pressed]="aiPanelOpen() ? true : null"
					[attr.aria-label]="'pptx.toolbar.toggleAiAssistant' | translate"
					[title]="'pptx.toolbar.toggleAiAssistant' | translate"
					(click)="toggleAiPanel.emit()"
				>
					<svg lucideSparkles class="pptx-ng-mtoolbar-icon" aria-hidden="true"></svg>
				</button>
			}

			<!--
				Save / download: surfaced directly so it's reachable without the
				Menu sheet, and available even in view-only mode where the editor
				controls above are hidden.
			-->
			<button
				type="button"
				class="pptx-ng-mtoolbar-btn"
				[attr.aria-label]="'pptx.toolbar.save' | translate"
				[title]="'pptx.toolbar.save' | translate"
				(click)="save.emit()"
			>
				<svg lucideDownload class="pptx-ng-mtoolbar-icon" aria-hidden="true"></svg>
			</button>

			<!-- Present: same Lucide "presentation" glyph React's mobile bar uses. -->
			@if (!toolbar.isHidden('fullscreen')) {
				<button
					type="button"
					class="pptx-ng-mtoolbar-btn pptx-ng-mtoolbar-present"
					[attr.aria-label]="'pptx.toolbar.present' | translate"
					[title]="'pptx.toolbar.present' | translate"
					[disabled]="!canPresent()"
					(click)="present.emit()"
				>
					<svg lucidePresentation class="pptx-ng-mtoolbar-icon" aria-hidden="true"></svg>
				</button>
			}

			<!--
				Share: start/join a real-time collaboration session. Sits last in
				the row (after Present) and renders as a filled primary pill, the
				same slot and treatment React's MobileToolbar gives it.
			-->
			@if (canEdit() && !toolbar.isHidden('share')) {
				<button
					type="button"
					class="pptx-ng-mtoolbar-btn pptx-ng-mtoolbar-share"
					[attr.aria-label]="'pptx.toolbar.share' | translate"
					[title]="'pptx.toolbar.share' | translate"
					(click)="share.emit()"
				>
					<svg lucideShare2 class="pptx-ng-mtoolbar-icon is-sm" aria-hidden="true"></svg>
				</button>
			}
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
				/*
				 * Themed chrome: the same semantic tokens React's mobile toolbar
				 * resolves through Tailwind (bg-secondary/50, border-border), so a
				 * ViewerTheme preset restyles this bar instead of leaving it on a
				 * hardcoded near-black that clashes with the rest of the UI.
				 */
				background: color-mix(in srgb, var(--pptx-secondary, #1f2937) 50%, transparent);
				border-bottom: 1px solid var(--pptx-border, #374151);
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
				color: color-mix(in srgb, var(--pptx-foreground, #f3f4f6) 80%, transparent);
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
				background: color-mix(in srgb, var(--pptx-accent, #1f2937) 60%, transparent);
			}

			.pptx-ng-mtoolbar-btn.is-active {
				color: var(--pptx-primary, #6366f1);
			}

			.pptx-ng-mtoolbar-btn[disabled] {
				opacity: 0.35;
				cursor: not-allowed;
			}

			.pptx-ng-mtoolbar-present {
				color: var(--pptx-primary, #6366f1);
			}

			.pptx-ng-mtoolbar-share {
				padding: 0 0.75rem;
				background: var(--pptx-primary, #6366f1);
				color: var(--pptx-primary-foreground, #ffffff);
			}

			.pptx-ng-mtoolbar-share:hover:not([disabled]) {
				background: color-mix(in srgb, var(--pptx-primary, #6366f1) 90%, transparent);
			}

			.pptx-ng-mtoolbar-icon {
				width: 1.25rem;
				height: 1.25rem;
				flex-shrink: 0;
			}

			.pptx-ng-mtoolbar-icon.is-sm {
				width: 1rem;
				height: 1rem;
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
	/** Whether the host opted into the AI assistant (shows the top-right toggle). */
	readonly aiEnabled = input<boolean>(false);
	/** Whether the AI assistant panel is currently open (highlights the button). */
	readonly aiPanelOpen = input<boolean>(false);
	/** Toolbar buttons the host wants hidden (gates Undo/Redo independently). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);

	/** User tapped the Menu (hamburger) button. */
	readonly toggleMenu = output<void>();
	/** User tapped the AI assistant toggle. */
	readonly toggleAiPanel = output<void>();
	/** User tapped Undo. */
	readonly undo = output<void>();
	/** User tapped Redo. */
	readonly redo = output<void>();
	/** User tapped Share (opens the collaboration share dialog). */
	readonly share = output<void>();
	/** User tapped Save (download as .pptx). */
	readonly save = output<void>();
	/** User tapped Present. */
	readonly present = output<void>();

	protected readonly toolbar = toolbarVisibility(this.hiddenActions);
}
