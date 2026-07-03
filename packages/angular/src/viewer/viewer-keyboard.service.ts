/**
 * viewer-keyboard.service.ts: Viewer-scoped editing keyboard-shortcut handler.
 * Only acts when the host is editable and not presenting and the user is not
 * typing in a field: Escape (disarm painter), "?" (shortcut cheat-sheet),
 * Ctrl/Cmd+Z/Y (undo/redo), Ctrl/Cmd+D/C/X/V/A/G (duplicate/copy/cut/paste/
 * select-all/(un)group), Delete/Backspace, arrow-key nudge (Shift = x10).
 *
 * Extracted from {@link PowerPointViewerComponent}: the component keeps the thin
 * `@HostListener('document:keydown')` (a decorator can only live on the
 * component) and forwards the event to {@link handleKeyDown}; the host binds the
 * canEdit / presenting / active-slide-index accessors via {@link bind}.
 *
 * Provide it once on the viewer component (`providers: [ViewerKeyboardService]`).
 */

import { inject, Injectable } from '@angular/core';

import { EditorStateService } from './editor-state.service';
import { ViewerDialogsService } from './viewer-dialogs.service';
import { ViewerFormatPainterService } from './viewer-format-painter.service';

/** Live host accessors the shortcut handler consults. */
interface KeyboardHost {
	readonly canEdit: () => boolean;
	readonly presenting: () => boolean;
	readonly activeSlideIndex: () => number;
}

@Injectable()
export class ViewerKeyboardService {
	private readonly editor = inject(EditorStateService);
	private readonly dialogs = inject(ViewerDialogsService);
	private readonly formatPainter = inject(ViewerFormatPainterService);

	private host: KeyboardHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: KeyboardHost): void {
		this.host = host;
	}

	handleKeyDown(event: KeyboardEvent): void {
		const host = this.host;
		if (!host || !host.canEdit() || host.presenting()) {
			return;
		}
		const target = event.target as HTMLElement | null;
		const tag = target?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
			return;
		}

		// Escape disarms the format painter first (mirrors React/Vue).
		if (event.key === 'Escape' && this.formatPainter.active()) {
			event.preventDefault();
			this.formatPainter.cancel();
			return;
		}

		// "?" opens the keyboard-shortcut cheat sheet (mirrors React).
		if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
			event.preventDefault();
			this.dialogs.showShortcuts.set(true);
			return;
		}

		const mod = event.ctrlKey || event.metaKey;
		const idx = host.activeSlideIndex();

		if (mod && (event.key === 'z' || event.key === 'Z')) {
			event.preventDefault();
			if (event.shiftKey) {
				this.editor.redo();
			} else {
				this.editor.undo();
			}
			return;
		}
		if (mod && (event.key === 'y' || event.key === 'Y')) {
			event.preventDefault();
			this.editor.redo();
			return;
		}
		if (mod && (event.key === 'd' || event.key === 'D')) {
			event.preventDefault();
			this.editor.duplicateSelected(idx);
			return;
		}
		if (mod && (event.key === 'c' || event.key === 'C')) {
			event.preventDefault();
			this.editor.copySelected(idx);
			return;
		}
		if (mod && (event.key === 'x' || event.key === 'X')) {
			event.preventDefault();
			this.editor.cutSelected(idx);
			return;
		}
		if (mod && (event.key === 'v' || event.key === 'V')) {
			event.preventDefault();
			this.editor.paste(idx);
			return;
		}
		if (mod && (event.key === 'a' || event.key === 'A')) {
			event.preventDefault();
			this.editor.selectAll(idx);
			return;
		}
		if (mod && (event.key === 'g' || event.key === 'G')) {
			event.preventDefault();
			if (event.shiftKey) {
				this.editor.ungroupSelected(idx);
			} else {
				this.editor.groupSelected(idx);
			}
			return;
		}

		if (!this.editor.hasSelection()) {
			return;
		}

		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			this.editor.deleteSelected(idx);
			return;
		}

		const step = event.shiftKey ? 10 : 1;
		switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				this.editor.moveSelectedBy(idx, -step, 0);
				break;
			case 'ArrowRight':
				event.preventDefault();
				this.editor.moveSelectedBy(idx, step, 0);
				break;
			case 'ArrowUp':
				event.preventDefault();
				this.editor.moveSelectedBy(idx, 0, -step);
				break;
			case 'ArrowDown':
				event.preventDefault();
				this.editor.moveSelectedBy(idx, 0, step);
				break;
			default:
				break;
		}
	}
}
