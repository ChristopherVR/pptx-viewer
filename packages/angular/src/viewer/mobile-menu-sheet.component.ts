/**
 * mobile-menu-sheet.component.ts: Mobile slide-up sheet for overflow actions.
 *
 * Ported from: packages/react/src/viewer/components/mobile/MobileMenuSheet.tsx
 *
 * Presents actions that don't fit the bottom bar (export, find, slide sorter,
 * speaker notes, presenter view, print) as a list of tappable rows inside a
 * `MobileSheetComponent`. Each row emits an `output()` event so the orchestrator
 * can route it to the matching existing handler without this component knowing
 * about service internals.
 *
 * Inputs
 *   open        : controls sheet visibility
 *   slideCount  : used to disable export/present actions on empty decks
 *   exporting   : when true, disables export actions and shows a spinner label
 *   showNotes   : whether the notes panel is currently visible (for toggling)
 *   canEdit     : gates editor-only actions (find-replace, sorter)
 *
 * Outputs
 *   closed        : user dismissed the sheet
 *   openFind      : open the find-in-slides bar
 *   openSorter    : open the slide-sorter overlay
 *   toggleNotes   : toggle the speaker-notes panel
 *   present       : start the fullscreen presentation
 *   exportPng     : export current slide as PNG
 *   exportPdf     : export deck as PDF
 *   exportGif     : export deck as animated GIF
 *   exportVideo   : export deck as video
 *   print         : open print dialog
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { ToolbarActionId } from '../internal/shared';
import { buildMobileMenuRows } from './mobile-menu-rows';
import type { MobileMenuRow } from './mobile-menu-rows';
import { MobileSheetComponent } from './mobile-sheet.component';

@Component({
	selector: 'pptx-mobile-menu-sheet',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [MobileSheetComponent, TranslatePipe],
	template: `
		<pptx-mobile-sheet
			[open]="open()"
			[title]="'pptx.mobileMenu.title' | translate"
			[heightFraction]="0.72"
			(closed)="closed.emit()"
		>
			<ul class="pptx-ng-mmenu-list" role="menu">
				@for (row of rows(); track row.key) {
					<li role="none">
						<button
							type="button"
							class="pptx-ng-mmenu-row"
							[class.is-active]="row.active"
							[class.is-danger]="row.danger"
							[disabled]="row.disabled"
							[attr.aria-label]="row.labelKey | translate"
							(click)="onRowClick(row)"
						>
							<span class="pptx-ng-mmenu-icon" aria-hidden="true">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									width="20"
									height="20"
								>
									<path [attr.d]="row.svgPath" />
								</svg>
							</span>
							<span class="pptx-ng-mmenu-text">
								<span class="pptx-ng-mmenu-label">{{ row.labelKey | translate }}</span>
								@if (row.sublabelKey) {
									<span class="pptx-ng-mmenu-sublabel">{{ row.sublabelKey | translate }}</span>
								}
							</span>
							@if (row.active) {
								<span class="pptx-ng-mmenu-check" aria-hidden="true">&#10003;</span>
							}
						</button>
					</li>
				}
			</ul>
		</pptx-mobile-sheet>
	`,
	styles: [
		`
			:host {
				display: contents;
			}

			/* ── Menu list ── */

			.pptx-ng-mmenu-list {
				list-style: none;
				margin: 0;
				padding: 0.5rem 0;
			}

			/* ── Row button ── */

			.pptx-ng-mmenu-row {
				display: flex;
				align-items: center;
				gap: 0.875rem;
				width: 100%;
				padding: 0.75rem 1.25rem;
				border: none;
				background: transparent;
				color: #e5e5e5;
				text-align: left;
				cursor: pointer;
				touch-action: manipulation;
				-webkit-tap-highlight-color: transparent;
				transition: background 0.1s;
			}

			.pptx-ng-mmenu-row:hover:not([disabled]) {
				background: rgba(255, 255, 255, 0.06);
			}

			.pptx-ng-mmenu-row:active:not([disabled]) {
				background: rgba(255, 255, 255, 0.1);
			}

			.pptx-ng-mmenu-row.is-active {
				color: #3b82f6;
			}

			.pptx-ng-mmenu-row.is-danger {
				color: #ef4444;
			}

			.pptx-ng-mmenu-row[disabled] {
				opacity: 0.35;
				cursor: not-allowed;
			}

			/* ── Icon wrapper ── */

			.pptx-ng-mmenu-icon {
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				width: 1.5rem;
				opacity: 0.8;
			}

			/* ── Text block ── */

			.pptx-ng-mmenu-text {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				flex: 1;
				min-width: 0;
			}

			.pptx-ng-mmenu-label {
				font-size: 0.9375rem;
				font-weight: 500;
				line-height: 1.3;
			}

			.pptx-ng-mmenu-sublabel {
				font-size: 0.75rem;
				color: rgba(255, 255, 255, 0.45);
				line-height: 1.3;
			}

			/* ── Active check ── */

			.pptx-ng-mmenu-check {
				color: #3b82f6;
				font-size: 1rem;
				flex-shrink: 0;
			}

			/* ── Divider between action groups ── */

			.pptx-ng-mmenu-divider {
				height: 1px;
				background: rgba(255, 255, 255, 0.08);
				margin: 0.375rem 0;
			}
		`,
	],
})
export class MobileMenuSheetComponent {
	// ── Inputs ────────────────────────────────────────────────────────────────

	/** Whether the sheet is visible. */
	readonly open = input<boolean>(false);

	/** Total slide count: gates export/present actions. */
	readonly slideCount = input<number>(0);

	/** True while an export is running (labels update, actions are disabled). */
	readonly exporting = input<boolean>(false);

	/** Whether the speaker-notes panel is currently open. */
	readonly showNotes = input<boolean>(false);

	/** Whether editor-only actions (find-replace etc.) are available. */
	readonly canEdit = input<boolean>(false);

	/** Toolbar buttons the host wants hidden ('notes' drops the row, 'export' drops all four export rows). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);

	// ── Outputs ───────────────────────────────────────────────────────────────

	/** Sheet dismissed (backdrop tap, swipe, or Escape). */
	readonly closed = output<void>();

	/** Open the find-in-slides bar. */
	readonly openFind = output<void>();

	/** Open the slide-sorter overlay. */
	readonly openSorter = output<void>();

	/** Toggle the speaker-notes panel. */
	readonly toggleNotes = output<void>();

	/** Insert a text box on the active slide. */
	readonly insertText = output<void>();

	/** Start the fullscreen presentation mode. */
	readonly present = output<void>();

	/** Open another presentation (File ▸ Open). */
	readonly openFile = output<void>();

	/** Save (download) the deck as a `.pptx` file. */
	readonly savePptx = output<void>();

	/** Export the current slide as PNG. */
	readonly exportPng = output<void>();

	/** Export the deck as PDF. */
	readonly exportPdf = output<void>();

	/** Export the deck as an animated GIF. */
	readonly exportGif = output<void>();

	/** Export the deck as a video. */
	readonly exportVideo = output<void>();

	/** Open the print dialog. */
	readonly print = output<void>();

	// ── Derived row list ──────────────────────────────────────────────────────

	readonly rows = computed<MobileMenuRow[]>(() =>
		buildMobileMenuRows(
			{
				slideCount: this.slideCount(),
				exporting: this.exporting(),
				showNotes: this.showNotes(),
				canEdit: this.canEdit(),
				hiddenActions: this.hiddenActions(),
			},
			{
				insertText: () => this.insertText.emit(),
				openFind: () => this.openFind.emit(),
				openSorter: () => this.openSorter.emit(),
				toggleNotes: () => this.toggleNotes.emit(),
				present: () => this.present.emit(),
				exportPng: () => this.exportPng.emit(),
				exportPdf: () => this.exportPdf.emit(),
				exportGif: () => this.exportGif.emit(),
				exportVideo: () => this.exportVideo.emit(),
				openFile: () => this.openFile.emit(),
				savePptx: () => this.savePptx.emit(),
				print: () => this.print.emit(),
			},
		),
	);

	/**
	 * Emit the row's action and close the sheet so the user returns to the
	 * presentation immediately.
	 */
	onRowClick(row: MobileMenuRow): void {
		if (!row.disabled) {
			row.emit();
			this.closed.emit();
		}
	}
}
