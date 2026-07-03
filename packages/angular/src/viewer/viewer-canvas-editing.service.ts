/**
 * viewer-canvas-editing.service.ts: Viewer-scoped state + logic for direct
 * canvas interactions on the active slide: element/background/context-menu
 * selection, inline text edit (incl. the equation-editor detour), ink stroke
 * completion + eraser hits, table cell/structural edits, and the slide
 * background/notes property edits. This is the single largest concern pulled
 * off `PowerPointViewerComponent`'s `SlideCanvasComponent` output wiring.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds the
 * few accessors it alone owns (canEdit / active-slide / active-slide-index)
 * via {@link bind}; the template reads the signals / invokes the handlers off
 * the injected instance directly (same pattern as `session`/`xport`).
 *
 * Provide it once on the viewer component (`providers: [ViewerCanvasEditingService]`).
 */

import { inject, Injectable, signal } from '@angular/core';
import type { InkPptxElement, PptxSlide, PptxTableData, TextStyle } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { textStylePatch } from './inspector-helpers';
import { setCellText } from './table-data-helpers';
import type { TableCellCommit } from './table-renderer.component';
import { ViewerDialogsService } from './viewer-dialogs.service';
import { ViewerFormatPainterService } from './viewer-format-painter.service';

/** Live host accessors the canvas-editing controller needs. */
interface CanvasEditingHost {
	readonly canEdit: () => boolean;
	readonly activeSlide: () => PptxSlide | undefined;
	readonly activeSlideIndex: () => number;
}

@Injectable()
export class ViewerCanvasEditingService {
	private readonly editor = inject(EditorStateService);
	private readonly dialogs = inject(ViewerDialogsService);
	private readonly formatPainter = inject(ViewerFormatPainterService);

	/** Id of the element being inline text-edited, or null. */
	readonly editingId = signal<string | null>(null);
	/** Open editor context-menu position (client coords), or null. */
	readonly contextMenuPos = signal<{ x: number; y: number } | null>(null);

	private host: CanvasEditingHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: CanvasEditingHost): void {
		this.host = host;
	}

	private requireHost(): CanvasEditingHost {
		if (!this.host) {
			throw new Error('ViewerCanvasEditingService.bind() was not called');
		}
		return this.host;
	}

	/**
	 * Double-click text edit entry: equations open the equation editor instead
	 * of the inline text editor (mirrors React's dbl-click-to-edit-equation).
	 */
	onTextEditStart(id: string): void {
		const host = this.requireHost();
		const element = host.activeSlide()?.elements.find((el) => el.id === id);
		const segments = element && 'textSegments' in element ? element.textSegments : undefined;
		const equation = segments?.find((segment) => segment.equationXml);
		if (host.canEdit() && equation?.equationXml) {
			this.dialogs.openEquationEdit(id, equation.equationXml);
			return;
		}
		this.editingId.set(id);
	}

	/** Apply a Ctrl/Cmd+B/I/U toggle from the inline editor (undoable). */
	onTextFormat(event: { id: string; updates: Partial<TextStyle> }): void {
		const host = this.requireHost();
		if (!host.canEdit()) {
			return;
		}
		const element = host.activeSlide()?.elements.find((el) => el.id === event.id);
		if (!element) {
			return;
		}
		this.editor.updateElement(
			host.activeSlideIndex(),
			event.id,
			textStylePatch(element, event.updates),
		);
	}

	/** Commit an inline text edit: replace the element's text (one history entry). */
	onTextCommit(event: { id: string; text: string }): void {
		const host = this.requireHost();
		this.editor.updateElement(host.activeSlideIndex(), event.id, {
			text: event.text,
			textSegments: [],
		});
		this.editingId.set(null);
	}

	/** Receive a completed ink stroke and append it to the active slide. */
	onInkStrokeComplete(ink: InkPptxElement): void {
		const host = this.requireHost();
		if (!host.canEdit()) {
			return;
		}
		this.editor.addElement(host.activeSlideIndex(), ink);
	}

	/** Receive an eraser hit and delete the targeted ink element. */
	onEraserHit(id: string): void {
		const host = this.requireHost();
		if (!host.canEdit()) {
			return;
		}
		this.editor.select([id]);
		this.editor.deleteSelected(host.activeSlideIndex());
	}

	/**
	 * Handle an element press from the canvas. Additive (Shift/Ctrl) toggles
	 * membership; a plain press selects the element (keeping it selected if it
	 * already was, so a subsequent drag works).
	 */
	onElementSelect(event: { id: string; additive: boolean }): void {
		// The armed format painter intercepts the next element click: apply the
		// copied format to the target, then disarm (no selection change).
		if (this.formatPainter.active()) {
			this.formatPainter.applyToTarget(event.id);
			this.formatPainter.cancel();
			return;
		}
		if (event.additive) {
			this.editor.toggleSelect(event.id, true);
		} else if (!this.editor.isSelected(event.id)) {
			this.editor.select([event.id]);
		}
	}

	/** Empty-stage press: disarm the painter if armed, else clear the selection. */
	onBackgroundClick(): void {
		if (this.formatPainter.active()) {
			this.formatPainter.cancel();
			return;
		}
		this.editor.clearSelection();
	}

	/** Right-click: select the element under the cursor and open the menu. */
	onContextMenu(event: { id: string | null; x: number; y: number }): void {
		if (event.id && !this.editor.isSelected(event.id)) {
			this.editor.select([event.id]);
		}
		this.contextMenuPos.set({ x: event.x, y: event.y });
	}

	/** Update the active slide's background colour. */
	onSlideBackground(event: Event): void {
		this.editor.updateSlide(this.requireHost().activeSlideIndex(), {
			backgroundColor: (event.target as HTMLInputElement).value,
		});
	}

	/** Update the active slide's speaker notes. */
	onSlideNotes(event: Event): void {
		this.editor.updateSlide(this.requireHost().activeSlideIndex(), {
			notes: (event.target as HTMLTextAreaElement).value,
		});
	}

	/** Update the active slide's speaker notes from the editable NotesPanel. */
	onNotesUpdate(notes: string): void {
		this.editor.updateSlide(this.requireHost().activeSlideIndex(), { notes });
	}

	// ── Selection pane handlers ────────────────────────────────────────────────

	onSelectionPaneBringForward(id: string): void {
		this.editor.select([id]);
		this.editor.bringSelectedForward(this.requireHost().activeSlideIndex());
	}

	onSelectionPaneSendBackward(id: string): void {
		this.editor.select([id]);
		this.editor.sendSelectedBackward(this.requireHost().activeSlideIndex());
	}

	onToggleElementHidden(id: string): void {
		const host = this.requireHost();
		const el = host.activeSlide()?.elements.find((e) => e.id === id);
		if (el) {
			this.editor.updateElement(host.activeSlideIndex(), id, { hidden: !el.hidden });
		}
	}

	/**
	 * Commit a table cell's inline text edit. Finds the table element on the
	 * active slide, rebuilds its `tableData` with the new cell text, and patches
	 * it through the editor (which records undo history).
	 */
	onTableCellCommit(event: { id: string; commit: TableCellCommit }): void {
		const host = this.requireHost();
		if (!host.canEdit()) {
			return;
		}
		const el = host.activeSlide()?.elements.find((e) => e.id === event.id);
		if (!el || el.type !== 'table') {
			return;
		}
		const updated = setCellText(
			el,
			event.commit.rowIndex,
			event.commit.colIndex,
			event.commit.text,
		);
		this.editor.updateElement(host.activeSlideIndex(), event.id, {
			tableData: updated.tableData,
		});
	}

	/**
	 * Persist a structural table change originating on the canvas (column / row
	 * drag-resize) as one undoable history entry.
	 */
	onTableChange(event: { id: string; tableData: PptxTableData }): void {
		const host = this.requireHost();
		if (!host.canEdit()) {
			return;
		}
		this.editor.updateElement(host.activeSlideIndex(), event.id, {
			tableData: event.tableData,
		});
	}
}
