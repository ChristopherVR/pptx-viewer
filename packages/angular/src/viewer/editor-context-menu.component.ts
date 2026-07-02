/**
 * editor-context-menu.component.ts: Right-click context menu for the Angular
 * PPTX editor.
 *
 * Selector: `pptx-editor-context-menu`
 *
 * Renders a small floating panel at (x, y) viewport coordinates, wired to
 * EditorStateService. Closes on:
 *  - Escape key (via @HostListener)
 *  - A pointerdown event whose target is outside this component's host element
 *    (also via @HostListener; the very first outside-pointerdown that would
 *    have opened the menu is guarded by Angular's own event-propagation order:
 *    the host is mounted before the listener fires, so `!host.contains(target)`
 *    is always correct without any extra first-event guard).
 *
 * Usage:
 * ```html
 * @if (canEdit() && contextMenu(); as m) {
 *   <pptx-editor-context-menu
 *     [x]="m.x"
 *     [y]="m.y"
 *     [slideIndex]="activeSlideIndex()"
 *     (closed)="contextMenu.set(null)"
 *   />
 * }
 * ```
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	HostListener,
	inject,
	input,
	output,
} from '@angular/core';
import type { TablePptxElement } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import {
	insertColumn,
	insertRow,
	mergeDown,
	mergeRight,
	mergeSelection,
	removeColumn,
	removeRow,
	splitCursorCell,
} from './table-data-helpers';
import type { TableCellSelection } from './table-selection.service';
import { TableSelectionService } from './table-selection.service';

@Component({
	selector: 'pptx-editor-context-menu',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<ul class="pptx-ctx__menu" role="menu" aria-label="Context menu">
			<!-- ── Clipboard ─────────────────────────────────────────────────────── -->
			<li role="none">
				<button
					type="button"
					class="pptx-ctx__item"
					role="menuitem"
					[disabled]="!editor.hasSelection()"
					(click)="onCut()"
				>
					Cut
				</button>
			</li>
			<li role="none">
				<button
					type="button"
					class="pptx-ctx__item"
					role="menuitem"
					[disabled]="!editor.hasSelection()"
					(click)="onCopy()"
				>
					Copy
				</button>
			</li>
			<li role="none">
				<button
					type="button"
					class="pptx-ctx__item"
					role="menuitem"
					[disabled]="!editor.hasClipboard()"
					(click)="onPaste()"
				>
					Paste
				</button>
			</li>

			<!-- ── Divider ───────────────────────────────────────────────────────── -->
			<li role="separator" class="pptx-ctx__divider"></li>

			<!-- ── Element actions ───────────────────────────────────────────────── -->
			<li role="none">
				<button
					type="button"
					class="pptx-ctx__item"
					role="menuitem"
					[disabled]="!editor.hasSelection()"
					(click)="onDuplicate()"
				>
					Duplicate
				</button>
			</li>
			<li role="none">
				<button
					type="button"
					class="pptx-ctx__item pptx-ctx__item--danger"
					role="menuitem"
					[disabled]="!editor.hasSelection()"
					(click)="onDelete()"
				>
					Delete
				</button>
			</li>

			<!-- ── Divider ───────────────────────────────────────────────────────── -->
			<li role="separator" class="pptx-ctx__divider"></li>

			<!-- ── Z-order ───────────────────────────────────────────────────────── -->
			<li role="none">
				<button
					type="button"
					class="pptx-ctx__item"
					role="menuitem"
					[disabled]="!editor.hasSelection()"
					(click)="onBringToFront()"
				>
					Bring to Front
				</button>
			</li>
			<li role="none">
				<button
					type="button"
					class="pptx-ctx__item"
					role="menuitem"
					[disabled]="!editor.hasSelection()"
					(click)="onSendToBack()"
				>
					Send to Back
				</button>
			</li>
			<li role="none">
				<button
					type="button"
					class="pptx-ctx__item"
					role="menuitem"
					[disabled]="!editor.hasSelection()"
					(click)="onBringForward()"
				>
					Bring Forward
				</button>
			</li>
			<li role="none">
				<button
					type="button"
					class="pptx-ctx__item"
					role="menuitem"
					[disabled]="!editor.hasSelection()"
					(click)="onSendBackward()"
				>
					Send Backward
				</button>
			</li>

			<!-- Table row/column/merge actions (only when a table cell is selected) -->
			@if (tableCtx(); as tc) {
				<li role="separator" class="pptx-ctx__divider"></li>
				<li role="none">
					<button type="button" class="pptx-ctx__item" role="menuitem" (click)="onInsertRowAbove()">
						Insert Row Above
					</button>
				</li>
				<li role="none">
					<button type="button" class="pptx-ctx__item" role="menuitem" (click)="onInsertRowBelow()">
						Insert Row Below
					</button>
				</li>
				<li role="none">
					<button type="button" class="pptx-ctx__item" role="menuitem" (click)="onInsertColLeft()">
						Insert Column Left
					</button>
				</li>
				<li role="none">
					<button type="button" class="pptx-ctx__item" role="menuitem" (click)="onInsertColRight()">
						Insert Column Right
					</button>
				</li>
				<li role="none">
					<button
						type="button"
						class="pptx-ctx__item pptx-ctx__item--danger"
						role="menuitem"
						(click)="onDeleteRow()"
					>
						Delete Row
					</button>
				</li>
				<li role="none">
					<button
						type="button"
						class="pptx-ctx__item pptx-ctx__item--danger"
						role="menuitem"
						(click)="onDeleteColumn()"
					>
						Delete Column
					</button>
				</li>
				<li role="separator" class="pptx-ctx__divider"></li>
				@if (tc.sel.selectedCells && tc.sel.selectedCells.length >= 2) {
					<li role="none">
						<button
							type="button"
							class="pptx-ctx__item"
							role="menuitem"
							(click)="onMergeSelected()"
						>
							Merge Selected Cells
						</button>
					</li>
				}
				<li role="none">
					<button type="button" class="pptx-ctx__item" role="menuitem" (click)="onMergeRight()">
						Merge Right
					</button>
				</li>
				<li role="none">
					<button type="button" class="pptx-ctx__item" role="menuitem" (click)="onMergeDown()">
						Merge Down
					</button>
				</li>
				<li role="none">
					<button type="button" class="pptx-ctx__item" role="menuitem" (click)="onSplitCell()">
						Split Cell
					</button>
				</li>
			}
		</ul>
	`,
	styles: `
		:host {
			position: fixed;
			left: var(--pptx-ctx-x, 0px);
			top: var(--pptx-ctx-y, 0px);
			z-index: 9000;
			display: block;
		}

		.pptx-ctx__menu {
			list-style: none;
			margin: 0;
			padding: 4px 0;
			min-width: 160px;
			background: var(--pptx-ctx-bg, #252526);
			color: var(--pptx-ctx-fg, #e0e0e0);
			border: 1px solid var(--pptx-ctx-border, #454545);
			border-radius: 4px;
			box-shadow:
				0 4px 12px rgba(0, 0, 0, 0.4),
				0 1px 3px rgba(0, 0, 0, 0.3);
			font-size: 13px;
			user-select: none;
		}

		.pptx-ctx__item {
			display: block;
			width: 100%;
			padding: 5px 14px;
			background: transparent;
			border: none;
			color: inherit;
			text-align: left;
			cursor: pointer;
			font-size: inherit;
			white-space: nowrap;
		}

		.pptx-ctx__item:hover:not(:disabled) {
			background: var(--pptx-ctx-hover, #094771);
			color: var(--pptx-ctx-hover-fg, #ffffff);
		}

		.pptx-ctx__item:disabled {
			opacity: 0.4;
			pointer-events: none;
			cursor: default;
		}

		.pptx-ctx__item--danger {
			color: var(--pptx-ctx-danger, #f47c7c);
		}

		.pptx-ctx__item--danger:hover:not(:disabled) {
			background: var(--pptx-ctx-danger-hover, #4a1a1a);
			color: var(--pptx-ctx-danger-fg, #ffaaaa);
		}

		.pptx-ctx__divider {
			height: 1px;
			background: var(--pptx-ctx-divider, #454545);
			margin: 3px 0;
		}
	`,
	host: {
		'[style.--pptx-ctx-x]': 'x() + "px"',
		'[style.--pptx-ctx-y]': 'y() + "px"',
	},
})
export class EditorContextMenuComponent {
	/** Horizontal viewport coordinate (px) of the top-left corner of the menu. */
	readonly x = input.required<number>();
	/** Vertical viewport coordinate (px) of the top-left corner of the menu. */
	readonly y = input.required<number>();
	/** Zero-based index of the slide being edited. */
	readonly slideIndex = input.required<number>();

	/** Emitted when the menu should close (Escape or outside click). */
	readonly closed = output<void>();

	protected readonly editor = inject(EditorStateService);
	private readonly tableSelection = inject(TableSelectionService, { optional: true });
	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;

	/**
	 * The table element + cell selection the menu should act on, or null when the
	 * current selection is not a single table with a selected cell. Drives the
	 * table row/column/merge section of the menu.
	 */
	protected readonly tableCtx = computed<{
		element: TablePptxElement;
		sel: TableCellSelection;
	} | null>(() => {
		const sel = this.tableSelection?.selection();
		if (!sel) {
			return null;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		const el = slide?.elements.find((e) => e.id === sel.elementId);
		if (!el || el.type !== 'table') {
			return null;
		}
		return { element: el, sel };
	});

	// ── Close triggers ───────────────────────────────────────────────────────

	@HostListener('document:keydown.escape')
	onEscape(): void {
		this.closed.emit();
	}

	@HostListener('document:pointerdown', ['$event'])
	onDocumentPointerDown(event: PointerEvent): void {
		const target = event.target;
		if (!(target instanceof Node)) {
			return;
		}
		if (!this.host.nativeElement.contains(target)) {
			this.closed.emit();
		}
	}

	// ── Menu item actions ────────────────────────────────────────────────────

	protected onCut(): void {
		this.editor.cutSelected(this.slideIndex());
		this.closed.emit();
	}

	protected onCopy(): void {
		this.editor.copySelected(this.slideIndex());
		this.closed.emit();
	}

	protected onPaste(): void {
		this.editor.paste(this.slideIndex());
		this.closed.emit();
	}

	protected onDuplicate(): void {
		this.editor.duplicateSelected(this.slideIndex());
		this.closed.emit();
	}

	protected onDelete(): void {
		this.editor.deleteSelected(this.slideIndex());
		this.closed.emit();
	}

	protected onBringToFront(): void {
		this.editor.bringSelectedToFront(this.slideIndex());
		this.closed.emit();
	}

	protected onSendToBack(): void {
		this.editor.sendSelectedToBack(this.slideIndex());
		this.closed.emit();
	}

	protected onBringForward(): void {
		this.editor.bringSelectedForward(this.slideIndex());
		this.closed.emit();
	}

	protected onSendBackward(): void {
		this.editor.sendSelectedBackward(this.slideIndex());
		this.closed.emit();
	}

	// ── Table row / column / merge actions ─────────────────────────────────────

	protected onInsertRowAbove(): void {
		this.applyTable((el, sel) => insertRow(el, sel.rowIndex, 'above'));
	}
	protected onInsertRowBelow(): void {
		this.applyTable((el, sel) => insertRow(el, sel.rowIndex, 'below'));
	}
	protected onInsertColLeft(): void {
		this.applyTable((el, sel) => insertColumn(el, sel.columnIndex, 'left'));
	}
	protected onInsertColRight(): void {
		this.applyTable((el, sel) => insertColumn(el, sel.columnIndex, 'right'));
	}
	protected onDeleteRow(): void {
		this.applyTable((el, sel) => removeRow(el, sel.rowIndex));
	}
	protected onDeleteColumn(): void {
		this.applyTable((el, sel) => removeColumn(el, sel.columnIndex));
	}
	protected onMergeRight(): void {
		this.applyTable((el, sel) => mergeRight(el, sel.rowIndex, sel.columnIndex));
	}
	protected onMergeDown(): void {
		this.applyTable((el, sel) => mergeDown(el, sel.rowIndex, sel.columnIndex));
	}
	protected onSplitCell(): void {
		this.applyTable((el, sel) => splitCursorCell(el, sel.rowIndex, sel.columnIndex));
	}
	protected onMergeSelected(): void {
		this.applyTable((el, sel) => (sel.selectedCells ? mergeSelection(el, sel.selectedCells) : el));
	}

	/**
	 * Run a pure table transform on the current table context and commit the
	 * result through the editor (one undoable history entry), then close the menu.
	 */
	private applyTable(
		op: (element: TablePptxElement, sel: TableCellSelection) => TablePptxElement,
	): void {
		const ctx = this.tableCtx();
		if (!ctx) {
			return;
		}
		const updated = op(ctx.element, ctx.sel);
		if (updated.tableData) {
			this.editor.updateElement(this.slideIndex(), ctx.element.id, {
				tableData: updated.tableData,
			});
		}
		this.closed.emit();
	}
}
