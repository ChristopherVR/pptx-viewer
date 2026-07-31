/**
 * editor-context-menu.component.ts: Right-click context menu for the Angular
 * PPTX editor.
 *
 * Selector: `pptx-editor-context-menu`
 *
 * The item list is NOT written here. It comes from
 * `buildContextMenuEntries` in `pptx-viewer-shared`, which is the one
 * definition of what the canvas menu contains across all five bindings. This
 * component's job is to describe what was right-clicked, render the entries it
 * gets back, and route a chosen command to an editor operation. That is why
 * Edit Hyperlink, Add Comment, Group and Ungroup are here at all: they were
 * missing for as long as the list was hand-written, and nothing failed when
 * they were.
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
 *     (editHyperlink)="docProperties.showHyperlink.set(true)"
 *     (addComment)="openCommentsPanel()"
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
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, TablePptxElement } from 'pptx-viewer-core';

import type { ContextMenuCommandId, ContextMenuEntry } from '../internal/shared';
import { buildContextMenuEntries } from '../internal/shared';
import { tableMenuContext } from './editor-context-menu-context';
import type { ContextMenuActions, TableCommandOp } from './editor-context-menu-dispatch';
import { runContextMenuCommand } from './editor-context-menu-dispatch';
import { EDITOR_CONTEXT_MENU_STYLES } from './editor-context-menu.styles';
import { EditorStateService } from './editor-state.service';
import type { TableCellSelection } from './table-selection.service';
import { TableSelectionService } from './table-selection.service';

@Component({
	selector: 'pptx-editor-context-menu',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<!-- data-pptx-context-menu is the neutral cross-binding hook for "this is
		     the canvas context menu", alongside the role. -->
		<ul
			class="pptx-ctx__menu"
			data-pptx-context-menu="true"
			role="menu"
			[attr.aria-label]="'pptx.contextMenu.ariaLabel' | translate"
		>
			@for (entry of entries(); track entry.id) {
				@if (entry.separatorBefore) {
					<li role="separator" class="pptx-ctx__divider"></li>
				}
				<li role="none">
					<button
						type="button"
						class="pptx-ctx__item"
						[class.pptx-ctx__item--danger]="!!entry.danger"
						role="menuitem"
						[disabled]="!!entry.disabled"
						(click)="run(entry.id)"
					>
						{{ entry.labelKey | translate }}
					</button>
				</li>
			}
		</ul>
	`,
	styles: EDITOR_CONTEXT_MENU_STYLES,
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
	/**
	 * Whether to show the "Ask AI about this" / "Fix with AI" items. Gated by the
	 * host on the `ai` config + a single selected element.
	 */
	readonly showAiActions = input<boolean>(false);

	/** Emitted when the menu should close (Escape or outside click). */
	readonly closed = output<void>();
	/** "Ask AI about this": open the assistant scoped to the selection. */
	readonly askAi = output<void>();
	/** "Fix with AI": open the assistant with a prefilled fix directive. */
	readonly fixAi = output<void>();
	/**
	 * "Edit Hyperlink": the dialog lives at viewer level (it needs the selected
	 * element and the document-properties service), so the menu asks for it
	 * rather than owning it.
	 */
	readonly editHyperlink = output<void>();
	/** "Add Comment": open the right-docked comments panel, as React does. */
	readonly addComment = output<void>();

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

	/** The single selected element, or null on an empty or multi selection. */
	private readonly selectedElement = computed<PptxElement | null>(() => {
		const ids = this.editor.selectedIds();
		if (ids.length !== 1) {
			return null;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		return slide?.elements.find((el) => el.id === ids[0]) ?? null;
	});

	/** The menu, as the shared command list builds it for this right-click. */
	protected readonly entries = computed<ContextMenuEntry[]>(() => {
		const table = this.tableCtx();
		return buildContextMenuEntries({
			elementType: this.selectedElement()?.type ?? null,
			table: table ? tableMenuContext(table.element, table.sel) : null,
			hasMultiSelection: this.editor.selectedIds().length >= 2,
			aiEnabled: this.showAiActions(),
			hasClipboard: this.editor.hasClipboard(),
		});
	});

	/** Editor operations behind each command id (see the dispatch module). */
	private readonly actions: ContextMenuActions = {
		copy: () => this.editor.copySelected(this.slideIndex()),
		cut: () => this.editor.cutSelected(this.slideIndex()),
		paste: () => this.editor.paste(this.slideIndex()),
		duplicate: () => this.editor.duplicateSelected(this.slideIndex()),
		bringForward: () => this.editor.bringSelectedForward(this.slideIndex()),
		sendBackward: () => this.editor.sendSelectedBackward(this.slideIndex()),
		bringToFront: () => this.editor.bringSelectedToFront(this.slideIndex()),
		sendToBack: () => this.editor.sendSelectedToBack(this.slideIndex()),
		askAi: () => this.askAi.emit(),
		fixAi: () => this.fixAi.emit(),
		comment: () => this.addComment.emit(),
		hyperlink: () => this.editHyperlink.emit(),
		group: () => this.editor.groupSelected(this.slideIndex()),
		ungroup: () => this.editor.ungroupSelected(this.slideIndex()),
		remove: () => this.editor.deleteSelected(this.slideIndex()),
		applyTable: (op) => this.applyTable(op),
	};

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

	// ── Command dispatch ─────────────────────────────────────────────────────

	/** Run the chosen command, then close: every item closes the menu. */
	protected run(id: ContextMenuCommandId): void {
		runContextMenuCommand(id, this.actions);
		this.closed.emit();
	}

	/**
	 * Run a pure table transform on the current table context and commit the
	 * result through the editor (one undoable history entry).
	 */
	private applyTable(op: TableCommandOp): void {
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
	}
}
