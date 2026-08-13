/**
 * viewer-keyboard.service.ts: Viewer-scoped editing keyboard-shortcut handler.
 *
 * Key-to-action resolution is delegated to `mapEditorKey`, the shared editor
 * keymap every binding resolves against, so Angular cannot drift from React /
 * Vue / Vanilla / Svelte again. This service only supplies the guard state, then
 * performs the resolved action against {@link EditorStateService}.
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

import { isEditorTextInputTarget, mapEditorKey } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { ViewerDialogsService } from './viewer-dialogs.service';
import { ViewerFindReplaceService } from './viewer-find-replace.service';
import { ViewerFormatPainterService } from './viewer-format-painter.service';

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
}

@Injectable()
export class ViewerKeyboardService {
	private readonly editor = inject(EditorStateService);
	private readonly dialogs = inject(ViewerDialogsService);
	private readonly formatPainter = inject(ViewerFormatPainterService);
	private readonly findReplace = inject(ViewerFindReplaceService);

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
		const { action, dx, dy } = mapEditorKey(event, {
			canEdit: host.canEdit(),
			isPresenting: host.presenting(),
			hasSelection: this.editor.hasSelection(),
			isDrawing: host.isDrawing?.() ?? false,
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
			default:
				break;
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
