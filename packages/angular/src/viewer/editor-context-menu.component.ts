/** Element menu: shared commands, host extensions and Angular operation routing. */

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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement, TablePptxElement } from 'pptx-viewer-core';

import type { ContextMenuCommandId, CustomizedContextMenuEntry } from '../internal/shared';
import {
	buildContextMenuEntries,
	canCropElement,
	contextMenuInspectorAnchor,
	MERGE_SHAPES_LABEL_KEY,
	customizeContextMenuEntries,
	hostMenuLabel,
	isEditPointsEnabled,
	resolveEditPointsAvailability,
	scrollInspectorSectionIntoView,
} from '../internal/shared';
import { clampedMenuPosition } from './context-menu-position';
import { tableMenuContext } from './editor-context-menu-context';
import type { ContextMenuActions, TableCommandOp } from './editor-context-menu-dispatch';
import { runContextMenuCommand } from './editor-context-menu-dispatch';
import { EDITOR_CONTEXT_MENU_STYLES } from './editor-context-menu.styles';
import { EditorStateService } from './editor-state.service';
import { resolveContextMenuSelectionGroupable } from './group-lock-guard';
import { canMergeSelection, runMergeShapes } from './merge-shapes-action';
import { OutlineAuthoringService } from './outline-authoring.service';
import { PictureCropService } from './picture-crop.service';
import type { TableCellSelection } from './table-selection.service';
import { TableSelectionService } from './table-selection.service';
import { injectResolvedCustomization } from './viewer-customization.service';
import { ViewerInspectorPanelService } from './viewer-inspector-panel.service';

@Component({
	selector: 'pptx-editor-context-menu',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<!-- data-pptx-context-menu is the neutral cross-binding hook for "this is
		     the canvas context menu", alongside the role. -->
		<!-- An empty menu (host customisation removed every entry) renders nothing. -->
		@if (entries().length > 0) {
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
							(click)="run(entry)"
						>
							{{ hostLabel(entry) ?? (entry.labelKey | translate) }}
						</button>
					</li>
				}
			</ul>
		}
	`,
	styles: EDITOR_CONTEXT_MENU_STYLES,
	host: {
		'[style.--pptx-ctx-x]': 'position.left() + "px"',
		'[style.--pptx-ctx-y]': 'position.top() + "px"',
	},
})
export class EditorContextMenuComponent {
	protected readonly hostLabel = hostMenuLabel;
	/** Horizontal viewport coordinate (px) of the top-left corner of the menu. */
	readonly x = input.required<number>();
	/** Vertical viewport coordinate (px) of the top-left corner of the menu. */
	readonly y = input.required<number>();
	/** Zero-based index of the slide being edited. */
	readonly slideIndex = input.required<number>();
	/** Show "Ask AI about this" / "Fix with AI" (host: `ai` config + one selection). */
	readonly showAiActions = input<boolean>(false);

	/** Emitted when the menu should close (Escape or outside click). */
	readonly closed = output<void>();
	/** "Ask AI about this": open the assistant scoped to the selection. */
	readonly askAi = output<void>();
	/** "Fix with AI": open the assistant with a prefilled fix directive. */
	readonly fixAi = output<void>();
	/** "Edit Hyperlink": the dialog lives at viewer level, so the menu asks for it. */
	readonly editHyperlink = output<void>();
	/** "Add Comment": open the right-docked comments panel, as React does. */
	readonly addComment = output<void>();
	/** "Edit Text": the host owns the inline-text-edit entry point a double-click uses. */
	readonly editText = output<void>();
	/** "Save as Picture": the host owns the DOM lookup + html2canvas driver it needs. */
	readonly saveAsPicture = output<void>();

	protected readonly editor = inject(EditorStateService);
	private readonly tableSelection = inject(TableSelectionService, { optional: true });
	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;
	protected readonly position = clampedMenuPosition(this.host, this.x, this.y);
	private readonly inspectorPanel = inject(ViewerInspectorPanelService);
	private readonly customization = injectResolvedCustomization();
	private readonly outline = inject(OutlineAuthoringService, { optional: true });
	private readonly crop = inject(PictureCropService, { optional: true });
	private readonly translate = inject(TranslateService, { optional: true });

	/** The single table + selected cell the table commands act on, or null. */
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

	/** Lock-only Group/Ungroup gating (`@noGrp`); see `group-lock-guard.ts`. */
	private readonly selectionGroupable = computed(() =>
		resolveContextMenuSelectionGroupable(
			this.editor.slides()[this.slideIndex()],
			this.editor.selectedIds(),
		),
	);

	/** The menu, as the shared command list builds it for this right-click. */
	protected readonly entries = computed<CustomizedContextMenuEntry[]>(() => {
		const table = this.tableCtx();
		const built = buildContextMenuEntries({
			elementType: this.selectedElement()?.type ?? null,
			table: table ? tableMenuContext(table.element, table.sel) : null,
			hasMultiSelection: this.editor.selectedIds().length >= 2,
			selectionGroupable: this.selectionGroupable(),
			aiEnabled: this.showAiActions(),
			hasClipboard: this.editor.hasClipboard(),
			editPoints: this.outline ? resolveEditPointsAvailability(this.selectedElement()) : undefined,
			canMergeShapes: canMergeSelection(this.editor, this.slideIndex()),
			canCrop: canCropElement(this.selectedElement()),
		});
		return customizeContextMenuEntries(built, this.customization(), {
			slideIndex: this.slideIndex(),
			elementIds: [...this.editor.selectedIds()],
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
		editText: () => this.editText.emit(),
		editPoints: () => {
			if (isEditPointsEnabled(this.customization())) {
				this.outline?.startEditPoints(this.selectedElement());
			}
		},
		saveAsPicture: () => this.saveAsPicture.emit(),
		editAltText: () => this.focusInspectorSection('edit-alt-text'),
		sizeAndPosition: () => this.focusInspectorSection('size-and-position'),
		formatShape: () => this.focusInspectorSection('format-shape'),
		applyTable: (op) => this.applyTable(op),
		mergeShapes: (op) =>
			runMergeShapes(
				this.editor,
				this.slideIndex(),
				op,
				this.translate?.instant(MERGE_SHAPES_LABEL_KEY) as string | undefined,
			),
		crop: () => this.crop?.enter(this.slideIndex(), this.selectedElement()),
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
	protected run(id: ContextMenuCommandId | CustomizedContextMenuEntry): void {
		if (typeof id !== 'string') {
			if ('host' in id) {
				this.closed.emit();
				id.onSelect();
				return;
			}
			id = id.id;
		}
		runContextMenuCommand(id, this.actions);
		this.closed.emit();
	}

	/**
	 * "Edit Alt Text" / "Size and Position" / "Format Shape": open the
	 * properties tab (clearing any explicit tool panel so the element view
	 * shows through) and, once the panel has re-rendered, scroll the matching
	 * inspector section into view. A binding-wide no-op when the section has
	 * not been tagged, so this never fails loudly.
	 */
	private focusInspectorSection(
		commandId: 'edit-alt-text' | 'size-and-position' | 'format-shape',
	): void {
		this.inspectorPanel.formatPanelClosed.set(false);
		this.inspectorPanel.activePanel.set(null);
		const anchor = contextMenuInspectorAnchor(commandId);
		if (!anchor) {
			return;
		}
		requestAnimationFrame(() => {
			requestAnimationFrame(() => scrollInspectorSectionIntoView(document, anchor));
		});
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
		if (updated !== ctx.element && updated.tableData) {
			const patch: Partial<TablePptxElement> = {
				tableData: updated.tableData,
			};
			if (updated.rawXml !== ctx.element.rawXml) {
				patch.rawXml = updated.rawXml;
			}
			this.editor.updateElement(this.slideIndex(), ctx.element.id, patch);
		}
	}
}
