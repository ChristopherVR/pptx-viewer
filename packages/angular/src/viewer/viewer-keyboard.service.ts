/**
 * viewer-keyboard.service.ts: Viewer-scoped editing keyboard-shortcut handler.
 *
 * Key-to-action resolution is delegated to `mapEditorKey`, the shared editor
 * keymap every binding resolves against, so Angular cannot drift from React /
 * Vue / Vanilla / Svelte again. This service only supplies the guard state, then
 * performs the resolved action against {@link EditorStateService}.
 *
 * F5 / Shift+F5 (real PowerPoint's "start the show") are resolved separately by
 * the shared `mapSlideShowStartKey`, ahead of `mapEditorKey`, because they must
 * fire regardless of `canEdit` or the event target: PowerPoint starts the show
 * even from a read-only deck and even with the caret in a text box.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component keeps the thin
 * `@HostListener('document:keydown')` (a decorator can only live on the
 * component) and forwards the event to {@link handleKeyDown}; the host binds the
 * canEdit / presenting / active-slide-index / navigation accessors via
 * {@link bind}.
 *
 * Provide it once on the viewer component (`providers: [ViewerKeyboardService]`).
 */

import { inject, Injectable } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import {
	cycleSelectableElement,
	isEditorTextInputTarget,
	mapEditorKey,
	mapSlideShowStartKey,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { ViewerCanvasEditingService } from './viewer-canvas-editing.service';
import { ViewerDialogsService } from './viewer-dialogs.service';
import { ViewerDocumentPropertiesService } from './viewer-document-properties.service';
import { ViewerFindReplaceService } from './viewer-find-replace.service';
import { ViewerFormatPainterService } from './viewer-format-painter.service';
import { applyTextCommand, stepSelectionFontSize } from './viewer-keyboard-text-commands';
import { ViewerPresentationModeService } from './viewer-presentation-mode.service';

/** Live host accessors the shortcut handler consults. */
interface KeyboardHost {
	readonly canEdit: () => boolean;
	readonly presenting: () => boolean;
	readonly activeSlideIndex: () => number;
	/**
	 * A Draw-tab tool other than the selection arrow is armed. The shared keymap
	 * stands its whole editing set down while one is, so a pen stroke is not also
	 * a Delete: every other binding passes this flag and Angular did not, which
	 * left Delete, Ctrl+D and the arrow nudges live over an armed pen.
	 */
	readonly isDrawing?: () => boolean;
	/** Go back one slide (the arrows page the deck when nothing is selected). */
	readonly goPrev?: () => void;
	/** Go forward one slide. */
	readonly goNext?: () => void;
	/**
	 * An inline text or table-cell editor is open. Needed so the text-command
	 * chords (alignment, font-size ladder, format painter, hyperlink, clear
	 * formatting) can survive `mapEditorKey`'s typing gate exactly as they do in
	 * the other four bindings, instead of only ever firing off a selection.
	 */
	readonly isEditingText?: () => boolean;
	/** The single selected element, the target of every text/format command. */
	readonly selectedElement?: () => PptxElement | null;
}

@Injectable()
export class ViewerKeyboardService {
	private readonly editor = inject(EditorStateService);
	private readonly dialogs = inject(ViewerDialogsService);
	private readonly formatPainter = inject(ViewerFormatPainterService);
	private readonly findReplace = inject(ViewerFindReplaceService);
	private readonly presentationMode = inject(ViewerPresentationModeService);
	private readonly docProperties = inject(ViewerDocumentPropertiesService);
	private readonly canvasEditing = inject(ViewerCanvasEditingService, { optional: true });

	private host: KeyboardHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: KeyboardHost): void {
		this.host = host;
	}

	handleKeyDown(event: KeyboardEvent): void {
		const host = this.host;
		if (!host) {
			return;
		}

		// F5 / Shift+F5 must start the show even with editing disabled and even
		// with the caret parked in a text box, exactly like real PowerPoint, so
		// this runs ahead of (and unguarded by) the canEdit/text-input gates
		// `mapEditorKey` applies below. `event.preventDefault()` only on a match:
		// otherwise the browser reloads the page on a bare F5.
		const showAction = mapSlideShowStartKey(event, { isPresenting: host.presenting() });
		if (showAction !== null) {
			event.preventDefault();
			if (showAction === 'fromBeginning') {
				this.presentationMode.presentFromBeginning();
			} else {
				this.presentationMode.present();
			}
			return;
		}

		const { action, dx, dy } = mapEditorKey(event, {
			canEdit: host.canEdit(),
			canPaste: this.editor.hasClipboard(),
			isPresenting: host.presenting(),
			hasSelection: this.editor.hasSelection(),
			isDrawing: host.isDrawing?.() ?? false,
			isEditingText: host.isEditingText?.() ?? false,
			isTextInputTarget: isEditorTextInputTarget(event.target),
		});
		if (action === null) {
			return;
		}
		event.preventDefault();

		const idx = host.activeSlideIndex();
		switch (action) {
			case 'escape':
				this.handleEscape();
				break;
			case 'toggleShortcuts':
				this.dialogs.showShortcuts.set(!this.dialogs.showShortcuts());
				break;
			case 'find':
				this.toggleFind();
				break;
			case 'undo':
				this.editor.undo();
				break;
			case 'redo':
				this.editor.redo();
				break;
			case 'duplicate':
				this.editor.duplicateSelected(idx);
				break;
			case 'copy':
				this.editor.copySelected(idx);
				break;
			case 'cut':
				this.editor.cutSelected(idx);
				break;
			case 'paste':
				this.editor.paste(idx);
				break;
			case 'selectAll':
				this.editor.selectAll(idx);
				break;
			case 'group':
				this.editor.groupSelected(idx);
				break;
			case 'ungroup':
				this.editor.ungroupSelected(idx);
				break;
			case 'delete':
				this.editor.deleteSelected(idx);
				break;
			case 'nudge':
				this.editor.moveSelectedBy(idx, dx ?? 0, dy ?? 0);
				break;
			case 'prevSlide':
				host.goPrev?.();
				break;
			case 'nextSlide':
				host.goNext?.();
				break;
			case 'alignLeft':
				this.applyTextPatch(idx, { align: 'left' });
				break;
			case 'alignCenter':
				this.applyTextPatch(idx, { align: 'center' });
				break;
			case 'alignRight':
				this.applyTextPatch(idx, { align: 'right' });
				break;
			case 'alignJustify':
				this.applyTextPatch(idx, { align: 'justify' });
				break;
			case 'increaseFontSize':
				stepSelectionFontSize(
					this.editor,
					idx,
					host.selectedElement?.() ?? null,
					'increase',
					this.canvasEditing,
				);
				break;
			case 'decreaseFontSize':
				stepSelectionFontSize(
					this.editor,
					idx,
					host.selectedElement?.() ?? null,
					'decrease',
					this.canvasEditing,
				);
				break;
			case 'copyFormat':
				this.formatPainter.toggle();
				break;
			case 'pasteFormat':
				this.pasteFormat();
				break;
			case 'newSlide':
				this.editor.addSlide(idx);
				break;
			case 'hyperlink':
				this.openHyperlink();
				break;
			case 'findReplace':
				this.findReplace.openFindReplace();
				break;
			case 'clearFormatting':
				this.applyTextPatch(idx, {
					bold: false,
					italic: false,
					underline: false,
					strikethrough: false,
				});
				break;
			case 'cycleSelectionNext':
				this.cycleSelection(idx, 'next');
				break;
			case 'cycleSelectionPrev':
				this.cycleSelection(idx, 'prev');
				break;
			case 'pasteSpecial':
				this.editor.isPasteSpecialDialogOpen.set(true);
				break;
			default:
				break;
		}
	}

	private applyTextPatch(slideIndex: number, patch: Parameters<typeof applyTextCommand>[3]): void {
		applyTextCommand(
			this.editor,
			slideIndex,
			this.host?.selectedElement?.() ?? null,
			patch,
			this.canvasEditing,
		);
	}

	/** Ctrl+Shift+V: apply the copied format to the current selection (no click needed). */
	private pasteFormat(): void {
		const id = this.editor.selectedIds()[0];
		if (id) {
			this.formatPainter.applyToTarget(id);
		}
	}

	/** Ctrl+K, gated on a selection exactly like the ribbon's hyperlink button. */
	private openHyperlink(): void {
		if (this.editor.hasSelection()) {
			this.docProperties.showHyperlink.set(true);
		}
	}

	/** Tab / Shift+Tab: move the selection to the next/previous element in z-order. */
	private cycleSelection(slideIndex: number, direction: 'next' | 'prev'): void {
		const ids = this.editor.slides()[slideIndex]?.elements.map((el) => el.id) ?? [];
		const nextId = cycleSelectableElement(ids, this.editor.selectedIds()[0] ?? null, direction);
		if (nextId) {
			this.editor.select([nextId]);
		}
	}

	/**
	 * Ctrl/Cmd+F toggles the find bar. Angular has shipped the bar since the
	 * find-replace port but had no shortcut for it at all, because the chord was
	 * hand-wired in React and Vue instead of living in the shared keymap.
	 *
	 * The full find-and-replace bar counts as "open" for the toggle: pressing the
	 * chord while it is up closes it rather than swapping it for the smaller find
	 * bar, which is what every other binding's single-panel toggle does.
	 */
	private toggleFind(): void {
		if (this.findReplace.showFind() || this.findReplace.showFindReplace()) {
			this.findReplace.showFind.set(false);
			this.findReplace.showFindReplace.set(false);
			return;
		}
		this.findReplace.showFind.set(true);
	}

	/**
	 * Escape unwinds the transient chrome one layer at a time: an armed format
	 * painter first (it is modal over the pointer), then the shortcut cheat
	 * sheet. Before this the branch stopped after the painter, so the panel "?"
	 * had just opened stayed on screen with no key that could dismiss it.
	 */
	private handleEscape(): void {
		if (this.formatPainter.active()) {
			this.formatPainter.cancel();
			return;
		}
		if (this.dialogs.showShortcuts()) {
			this.dialogs.showShortcuts.set(false);
		}
	}
}
