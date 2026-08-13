/**
 * viewer-keyboard.service.test.ts: the Angular binding's half of the shared
 * editor keymap.
 *
 * `mapEditorKey` is covered in `pptx-viewer-shared`; what is pinned here is the
 * wiring that used to be missing or wrong in Angular alone: Escape closing the
 * shortcut cheat sheet (its branch stopped at the format painter, so the panel
 * "?" opened could not be dismissed), the arrows paging the deck when nothing is
 * selected, and Ctrl+G / Ctrl+Shift+G still reaching group / ungroup.
 *
 * No TestBed (this package's suite has none): the service is built through a
 * plain `Injector` with stubbed collaborators.
 */

import { Injector, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { ViewerDialogsService } from './viewer-dialogs.service';
import { ViewerFindReplaceService } from './viewer-find-replace.service';
import { ViewerFormatPainterService } from './viewer-format-painter.service';
import { ViewerKeyboardService } from './viewer-keyboard.service';

/** The editor methods the keymap can reach, all spies. */
function editorStub(hasSelection: boolean) {
	return {
		hasSelection: () => hasSelection,
		undo: vi.fn(),
		redo: vi.fn(),
		duplicateSelected: vi.fn(),
		copySelected: vi.fn(),
		cutSelected: vi.fn(),
		paste: vi.fn(),
		selectAll: vi.fn(),
		groupSelected: vi.fn(),
		ungroupSelected: vi.fn(),
		deleteSelected: vi.fn(),
		moveSelectedBy: vi.fn(),
	};
}

interface Harness {
	service: ViewerKeyboardService;
	editor: ReturnType<typeof editorStub>;
	showShortcuts: ReturnType<typeof signal<boolean>>;
	/** The small find bar (Ctrl+F opens this one). */
	showFind: ReturnType<typeof signal<boolean>>;
	/** The full find-and-replace bar, reachable from Home > Editing > Replace. */
	showFindReplace: ReturnType<typeof signal<boolean>>;
	painterActive: ReturnType<typeof signal<boolean>>;
	cancelPainter: ReturnType<typeof vi.fn>;
	goPrev: ReturnType<typeof vi.fn>;
	goNext: ReturnType<typeof vi.fn>;
	press: (key: string, modifiers?: Partial<KeyboardEventInit>) => KeyboardEvent;
}

function harness(
	options: {
		hasSelection?: boolean;
		painterActive?: boolean;
		findOpen?: boolean;
		findReplaceOpen?: boolean;
	} = {},
): Harness {
	const editor = editorStub(options.hasSelection ?? true);
	const showShortcuts = signal(false);
	const showFind = signal(options.findOpen ?? false);
	const showFindReplace = signal(options.findReplaceOpen ?? false);
	const painterActive = signal(options.painterActive ?? false);
	const cancelPainter = vi.fn();
	const goPrev = vi.fn();
	const goNext = vi.fn();

	const injector = Injector.create({
		providers: [
			{ provide: EditorStateService, useValue: editor as unknown as EditorStateService },
			{
				provide: ViewerDialogsService,
				useValue: { showShortcuts } as unknown as ViewerDialogsService,
			},
			{
				provide: ViewerFormatPainterService,
				useValue: {
					active: painterActive,
					cancel: cancelPainter,
				} as unknown as ViewerFormatPainterService,
			},
			{
				provide: ViewerFindReplaceService,
				useValue: { showFind, showFindReplace } as unknown as ViewerFindReplaceService,
			},
			{ provide: ViewerKeyboardService, useClass: ViewerKeyboardService, deps: [] },
		],
	});
	const service = injector.get(ViewerKeyboardService);
	service.bind({
		canEdit: () => true,
		presenting: () => false,
		activeSlideIndex: () => 2,
		goPrev,
		goNext,
	});

	return {
		service,
		editor,
		showShortcuts,
		showFind,
		showFindReplace,
		painterActive,
		cancelPainter,
		goPrev,
		goNext,
		press(key, modifiers = {}) {
			const event = new KeyboardEvent('keydown', { key, cancelable: true, ...modifiers });
			service.handleKeyDown(event);
			return event;
		},
	};
}

describe('viewerKeyboardService: the shortcut cheat sheet', () => {
	it('opens on "?"', () => {
		const h = harness();
		h.press('?', { shiftKey: true });
		expect(h.showShortcuts()).toBeTruthy();
	});

	it('closes again on Escape', () => {
		const h = harness();
		h.showShortcuts.set(true);
		h.press('Escape');
		expect(h.showShortcuts()).toBeFalsy();
	});

	it('lets an armed format painter consume Escape first, leaving the panel open', () => {
		const h = harness({ painterActive: true });
		h.showShortcuts.set(true);
		h.press('Escape');
		expect(h.cancelPainter).toHaveBeenCalledOnce();
		expect(h.showShortcuts()).toBeTruthy();
	});
});

describe('viewerKeyboardService: grouping', () => {
	it('groups on Ctrl+G and ungroups on Ctrl+Shift+G, against the active slide', () => {
		const h = harness();
		h.press('g', { ctrlKey: true });
		expect(h.editor.groupSelected).toHaveBeenCalledWith(2);
		h.press('G', { ctrlKey: true, shiftKey: true });
		expect(h.editor.ungroupSelected).toHaveBeenCalledWith(2);
	});
});

describe('viewerKeyboardService: arrows', () => {
	it('nudges the selection one slide pixel, ten with shift', () => {
		const h = harness();
		h.press('ArrowRight');
		expect(h.editor.moveSelectedBy).toHaveBeenCalledWith(2, 1, 0);
		h.press('ArrowUp', { shiftKey: true });
		expect(h.editor.moveSelectedBy).toHaveBeenCalledWith(2, 0, -10);
	});

	it('pages the deck when nothing is selected', () => {
		const h = harness({ hasSelection: false });
		h.press('ArrowRight');
		expect(h.goNext).toHaveBeenCalledOnce();
		h.press('ArrowLeft');
		expect(h.goPrev).toHaveBeenCalledOnce();
		expect(h.editor.moveSelectedBy).not.toHaveBeenCalled();
	});
});

describe('viewerKeyboardService: guards', () => {
	it('ignores keys typed into a form field', () => {
		const h = harness();
		const input = document.createElement('input');
		document.body.appendChild(input);
		const event = new KeyboardEvent('keydown', { key: 'Delete', cancelable: true });
		Object.defineProperty(event, 'target', { value: input });
		h.service.handleKeyDown(event);
		expect(h.editor.deleteSelected).not.toHaveBeenCalled();
		input.remove();
	});

	it('preventDefaults only the keys it acts on', () => {
		const h = harness();
		expect(h.press('d', { ctrlKey: true }).defaultPrevented).toBeTruthy();
		expect(h.press('F7').defaultPrevented).toBeFalsy();
	});
});

/**
 * Ctrl+F. Angular has shipped a find bar since the find-replace port but had no
 * shortcut for it at all: the chord was hand-wired in React and Vue instead of
 * living in the shared keymap, so here it fell through to the browser's own
 * find, which cannot see text inside the slide model.
 */
describe('viewerKeyboardService: find', () => {
	it('opens the find bar on Ctrl+F', () => {
		const h = harness();
		const event = h.press('f', { ctrlKey: true });
		expect(h.showFind()).toBeTruthy();
		expect(event.defaultPrevented).toBeTruthy();
	});

	it('opens on Cmd+F too', () => {
		const h = harness();
		h.press('f', { metaKey: true });
		expect(h.showFind()).toBeTruthy();
	});

	it('closes an open find bar rather than reopening it', () => {
		const h = harness({ findOpen: true });
		h.press('f', { ctrlKey: true });
		expect(h.showFind()).toBeFalsy();
	});

	it('treats the full find-and-replace bar as open, and closes that too', () => {
		// Angular is the only binding with two panels; without this branch the
		// chord would swap the replace bar for the smaller find bar, where every
		// other binding simply closes.
		const h = harness({ findReplaceOpen: true });
		h.press('f', { ctrlKey: true });
		expect(h.showFindReplace()).toBeFalsy();
		expect(h.showFind()).toBeFalsy();
	});

	it('leaves a bare "f" alone', () => {
		const h = harness();
		const event = h.press('f');
		expect(h.showFind()).toBeFalsy();
		expect(event.defaultPrevented).toBeFalsy();
	});
});
