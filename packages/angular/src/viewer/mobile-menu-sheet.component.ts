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

import { MobileSheetComponent } from './mobile-sheet.component';

/** Descriptor for a single menu row. */
interface MenuRow {
	key: string;
	labelKey: string;
	sublabelKey?: string;
	/** SVG path data (24 × 24 view-box). */
	svgPath: string;
	disabled?: boolean;
	active?: boolean;
	danger?: boolean;
	emit: () => void;
}

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

	readonly rows = computed<MenuRow[]>(() => {
		const count = this.slideCount();
		const exp = this.exporting();
		const noSlides = count === 0;
		const editable = this.canEdit();

		return [
			// ── Insert (editor only) ────────────────────────────────────────────
			...(editable
				? [
						{
							key: 'insert-text',
							labelKey: 'pptx.mobileMenu.insertTextBox',
							svgPath: 'M12 5v14 M5 12h14',
							disabled: noSlides,
							emit: () => this.insertText.emit(),
						},
					]
				: []),
			// ── Navigation ──────────────────────────────────────────────────────
			{
				key: 'find',
				labelKey: 'pptx.mobileMenu.find',
				svgPath: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
				disabled: noSlides,
				emit: () => this.openFind.emit(),
			},
			{
				key: 'sorter',
				labelKey: 'pptx.mobileMenu.sorter',
				svgPath: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
				disabled: noSlides,
				emit: () => this.openSorter.emit(),
			},
			{
				key: 'notes',
				labelKey: 'pptx.mobileMenu.speakerNotes',
				svgPath:
					'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z',
				disabled: noSlides,
				active: this.showNotes(),
				emit: () => this.toggleNotes.emit(),
			},
			// ── Presentation ────────────────────────────────────────────────────
			{
				key: 'present',
				labelKey: 'pptx.mobileMenu.present',
				svgPath: 'M5 3l14 9-14 9V3z',
				disabled: noSlides,
				emit: () => this.present.emit(),
			},
			// ── Export ──────────────────────────────────────────────────────────
			{
				key: 'export-png',
				labelKey: 'pptx.mobileMenu.exportPng',
				sublabelKey: 'pptx.mobileMenu.currentSlide',
				svgPath:
					'M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
				disabled: noSlides || exp,
				emit: () => this.exportPng.emit(),
			},
			{
				key: 'export-pdf',
				labelKey: exp ? 'pptx.mobileMenu.exporting' : 'pptx.mobileMenu.exportPdf',
				sublabelKey: 'pptx.mobileMenu.allSlides',
				svgPath:
					'M7 21h10a2 2 0 0 0 2-2V9.414a1 1 0 0 0-.293-.707l-5.414-5.414A1 1 0 0 0 12.586 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z',
				disabled: noSlides || exp,
				emit: () => this.exportPdf.emit(),
			},
			{
				key: 'export-gif',
				labelKey: 'pptx.mobileMenu.exportGif',
				sublabelKey: 'pptx.mobileMenu.animated',
				svgPath:
					'M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z',
				disabled: noSlides || exp,
				emit: () => this.exportGif.emit(),
			},
			{
				key: 'export-video',
				labelKey: 'pptx.mobileMenu.exportVideo',
				sublabelKey: 'pptx.mobileMenu.mp4',
				svgPath:
					'M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z',
				disabled: noSlides || exp,
				emit: () => this.exportVideo.emit(),
			},
			// ── File ────────────────────────────────────────────────────────────
			{
				key: 'open-file',
				labelKey: 'pptx.mobileMenu.open',
				sublabelKey: 'pptx.mobileMenu.pptxExt',
				svgPath: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
				disabled: false,
				emit: () => this.openFile.emit(),
			},
			{
				key: 'save-pptx',
				labelKey: 'pptx.mobileMenu.save',
				sublabelKey: 'pptx.mobileMenu.pptxExt',
				svgPath: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
				disabled: noSlides,
				emit: () => this.savePptx.emit(),
			},
			{
				key: 'print',
				labelKey: 'pptx.mobileMenu.print',
				svgPath:
					'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6v-8z',
				disabled: noSlides,
				emit: () => this.print.emit(),
			},
		];
	});

	/**
	 * Emit the row's action and close the sheet so the user returns to the
	 * presentation immediately.
	 */
	onRowClick(row: MenuRow): void {
		if (!row.disabled) {
			row.emit();
			this.closed.emit();
		}
	}
}
