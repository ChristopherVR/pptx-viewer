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
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { textFontSizePtToPx } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { ViewerDialogsService } from './viewer-dialogs.service';
import { ViewerDocumentPropertiesService } from './viewer-document-properties.service';
import { ViewerFindReplaceService } from './viewer-find-replace.service';
import { ViewerFormatPainterService } from './viewer-format-painter.service';
import { ViewerKeyboardService } from './viewer-keyboard.service';
import { ViewerPresentationModeService } from './viewer-presentation-mode.service';

/** A minimal selectable text shape, for the alignment/font-size/clear-format tests. */
function textElement(id: string): PptxElement {
	return {
		id,
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hello',
		textStyle: { fontSize: 24 },
	} as unknown as PptxElement;
}

/** The editor methods the keymap can reach, all spies. */
function editorStub(hasSelection: boolean, selectedIds: readonly string[] = []) {
	const idsSignal = signal(selectedIds);
	const slidesSignal = signal<readonly PptxSlide[]>([]);
	return {
		hasSelection: () => hasSelection,
		hasClipboard: signal(true),
		selectedIds: idsSignal,
		slides: slidesSignal,
		select: vi.fn(),
		updateElement: vi.fn(),
		addSlide: vi.fn(),
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
	togglePainter: ReturnType<typeof vi.fn>;
	applyPainterToTarget: ReturnType<typeof vi.fn>;
	showHyperlink: ReturnType<typeof signal<boolean>>;
	goPrev: ReturnType<typeof vi.fn>;
	goNext: ReturnType<typeof vi.fn>;
	presentFromBeginning: ReturnType<typeof vi.fn>;
	present: ReturnType<typeof vi.fn>;
	press: (key: string, modifiers?: Partial<KeyboardEventInit>) => KeyboardEvent;
}

function harness(
	options: {
		hasSelection?: boolean;
		selectedIds?: readonly string[];
		selectedElement?: PptxElement | null;
		isEditingText?: boolean;
		painterActive?: boolean;
		findOpen?: boolean;
		findReplaceOpen?: boolean;
		canEdit?: boolean;
		presenting?: boolean;
	} = {},
): Harness {
	const editor = editorStub(options.hasSelection ?? true, options.selectedIds ?? []);
	const showShortcuts = signal(false);
	const showFind = signal(options.findOpen ?? false);
	const showFindReplace = signal(options.findReplaceOpen ?? false);
	const painterActive = signal(options.painterActive ?? false);
	const cancelPainter = vi.fn();
	const togglePainter = vi.fn();
	const applyPainterToTarget = vi.fn();
	const showHyperlink = signal(false);
	const openFindReplace = vi.fn(() => {
		showFind.set(false);
		showFindReplace.set(true);
	});
	const goPrev = vi.fn();
	const goNext = vi.fn();
	const presentFromBeginning = vi.fn();
	const present = vi.fn();

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
					toggle: togglePainter,
					applyToTarget: applyPainterToTarget,
				} as unknown as ViewerFormatPainterService,
			},
			{
				provide: ViewerFindReplaceService,
				useValue: {
					showFind,
					showFindReplace,
					openFindReplace,
				} as unknown as ViewerFindReplaceService,
			},
			{
				provide: ViewerDocumentPropertiesService,
				useValue: { showHyperlink } as unknown as ViewerDocumentPropertiesService,
			},
			{
				provide: ViewerPresentationModeService,
				useValue: { presentFromBeginning, present } as unknown as ViewerPresentationModeService,
			},
			// Optional, and deliberately not provided: mid-edit tests only need
			// `isEditingText`, and no test here exercises the live-inline-snapshot
			// branch, so `inject(ViewerCanvasEditingService, { optional: true })`
			// resolving to null is the exact behaviour production code falls back to.
			{ provide: ViewerKeyboardService, useClass: ViewerKeyboardService, deps: [] },
		],
	});
	const service = injector.get(ViewerKeyboardService);
	service.bind({
		canEdit: () => options.canEdit ?? true,
		presenting: () => options.presenting ?? false,
		activeSlideIndex: () => 2,
		goPrev,
		goNext,
		isEditingText: () => options.isEditingText ?? false,
		selectedElement: () => options.selectedElement ?? null,
	});

	return {
		service,
		editor,
		showShortcuts,
		showFind,
		showFindReplace,
		painterActive,
		cancelPainter,
		togglePainter,
		applyPainterToTarget,
		showHyperlink,
		goPrev,
		goNext,
		presentFromBeginning,
		present,
		press(key, modifiers = {}) {
			const event = new KeyboardEvent('keydown', { key, cancelable: true, ...modifiers });
			service.handleKeyDown(event);
			return event;
		},
	};
}

describe('viewerKeyboardService: the shortcut cheat sheet', () => {
	it.each([{ ctrlKey: true }, { metaKey: true }])(
		'does not prevent unavailable paste: %j',
		(modifiers) => {
			const h = harness({ hasSelection: false });
			h.editor.hasClipboard.set(false);
			expect(h.press('v', modifiers).defaultPrevented).toBeFalsy();
			expect(h.editor.paste).not.toHaveBeenCalled();
			h.editor.hasClipboard.set(true);
			expect(h.press('v', modifiers).defaultPrevented).toBeTruthy();
			expect(h.editor.paste).toHaveBeenCalledOnce();
		},
	);

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

/**
 * F5 / Shift+F5. Resolved by the shared `mapSlideShowStartKey`, ahead of
 * `mapEditorKey`, so it must reach the presentation-mode entry points even
 * while editing is disabled and even with the caret in a text field, exactly
 * like real PowerPoint.
 */
describe('viewerKeyboardService: F5 start-show keys', () => {
	it('starts the show from the beginning on F5 and prevents the reload', () => {
		const h = harness();
		const event = h.press('F5');
		expect(h.presentFromBeginning).toHaveBeenCalledOnce();
		expect(h.present).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeTruthy();
	});

	it('starts the show from the current slide on shift+F5', () => {
		const h = harness();
		h.press('F5', { shiftKey: true });
		expect(h.present).toHaveBeenCalledOnce();
		expect(h.presentFromBeginning).not.toHaveBeenCalled();
	});

	it('does nothing while already presenting, and does not preventDefault', () => {
		const h = harness({ presenting: true });
		const event = h.press('F5');
		expect(h.presentFromBeginning).not.toHaveBeenCalled();
		expect(h.present).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeFalsy();
	});

	it('still starts the show when editing is disabled', () => {
		const h = harness({ canEdit: false });
		h.press('F5');
		expect(h.presentFromBeginning).toHaveBeenCalledOnce();
	});

	it('still starts the show with the caret in a text input', () => {
		const h = harness();
		const input = document.createElement('input');
		document.body.appendChild(input);
		const event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });
		Object.defineProperty(event, 'target', { value: input });
		h.service.handleKeyDown(event);
		expect(h.presentFromBeginning).toHaveBeenCalledOnce();
		input.remove();
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

	it('opens the full find-and-replace bar on Ctrl+H, distinct from Ctrl+F', () => {
		const h = harness();
		h.press('h', { ctrlKey: true });
		expect(h.showFindReplace()).toBeTruthy();
	});
});

describe('viewerKeyboardService: PowerPoint text commands', () => {
	it('aligns the selection on Ctrl+L/E/R/J', () => {
		const el = textElement('a');
		const h = harness({ selectedElement: el, selectedIds: ['a'] });
		h.press('l', { ctrlKey: true });
		expect(h.editor.updateElement).toHaveBeenLastCalledWith(
			2,
			'a',
			expect.objectContaining({ textStyle: expect.objectContaining({ align: 'left' }) }),
		);
		h.press('e', { ctrlKey: true });
		expect(h.editor.updateElement).toHaveBeenLastCalledWith(
			2,
			'a',
			expect.objectContaining({ textStyle: expect.objectContaining({ align: 'center' }) }),
		);
	});

	it('fires the alignment chords while editing text, even with no selection', () => {
		const el = textElement('a');
		const h = harness({ selectedElement: el, hasSelection: false, isEditingText: true });
		h.press('r', { ctrlKey: true });
		expect(h.editor.updateElement).toHaveBeenLastCalledWith(
			2,
			'a',
			expect.objectContaining({ textStyle: expect.objectContaining({ align: 'right' }) }),
		);
	});

	it('does not align when nothing is selected and nothing is being edited', () => {
		const h = harness({ hasSelection: false });
		h.press('j', { ctrlKey: true });
		expect(h.editor.updateElement).not.toHaveBeenCalled();
	});

	it('steps the font size up on Ctrl+] and down on Ctrl+[', () => {
		// textElement('a') is authored at 24px = 18pt, exactly on the ladder.
		const el = textElement('a');
		const h = harness({ selectedElement: el, selectedIds: ['a'] });
		h.press(']', { ctrlKey: true });
		expect(h.editor.updateElement).toHaveBeenLastCalledWith(
			2,
			'a',
			expect.objectContaining({
				textStyle: expect.objectContaining({ fontSize: textFontSizePtToPx(20) }),
			}),
		);
	});

	it('steps the font size on Ctrl+Shift+>/<', () => {
		const el = textElement('a');
		const h = harness({ selectedElement: el, selectedIds: ['a'] });
		h.press('>', { ctrlKey: true, shiftKey: true });
		expect(h.editor.updateElement).toHaveBeenLastCalledWith(
			2,
			'a',
			expect.objectContaining({
				textStyle: expect.objectContaining({ fontSize: textFontSizePtToPx(20) }),
			}),
		);
	});

	it('arms the format painter on Ctrl+Shift+C', () => {
		const h = harness({ hasSelection: true });
		h.press('c', { ctrlKey: true, shiftKey: true });
		expect(h.togglePainter).toHaveBeenCalledOnce();
	});

	it('applies the copied format to the current selection on Ctrl+Shift+V', () => {
		const h = harness({ hasSelection: true, selectedIds: ['target'] });
		h.press('v', { ctrlKey: true, shiftKey: true });
		expect(h.applyPainterToTarget).toHaveBeenCalledWith('target');
	});

	it('inserts a new slide on Ctrl+M', () => {
		const h = harness({ hasSelection: false });
		h.press('m', { ctrlKey: true });
		expect(h.editor.addSlide).toHaveBeenCalledWith(2);
	});

	it('opens the hyperlink dialog on Ctrl+K when something is selected', () => {
		const h = harness({ hasSelection: true });
		h.press('k', { ctrlKey: true });
		expect(h.showHyperlink()).toBeTruthy();
	});

	it('leaves the hyperlink dialog closed on Ctrl+K with nothing selected', () => {
		const h = harness({ hasSelection: false });
		h.press('k', { ctrlKey: true });
		expect(h.showHyperlink()).toBeFalsy();
	});

	it('clears character formatting on Ctrl+Space', () => {
		const el = textElement('a');
		const h = harness({ selectedElement: el, selectedIds: ['a'] });
		h.press(' ', { ctrlKey: true });
		expect(h.editor.updateElement).toHaveBeenLastCalledWith(
			2,
			'a',
			expect.objectContaining({
				textStyle: expect.objectContaining({
					bold: false,
					italic: false,
					underline: false,
					strikethrough: false,
				}),
			}),
		);
	});
});

describe('viewerKeyboardService: Tab cycles the selection', () => {
	// harness() always binds activeSlideIndex to 2, so the slide under test has
	// to sit at that index; the two blanks ahead of it are never read.
	function slidesWith(ids: readonly string[]): readonly PptxSlide[] {
		const blank = { id: 'blank', elements: [] } as unknown as PptxSlide;
		const target = { id: 's1', elements: ids.map((id) => textElement(id)) } as unknown as PptxSlide;
		return [blank, blank, target];
	}

	it('selects the first element on Tab with nothing selected', () => {
		const h = harness({ hasSelection: false });
		h.editor.slides.set(slidesWith(['a', 'b', 'c']));
		h.press('Tab');
		expect(h.editor.select).toHaveBeenCalledWith(['a']);
	});

	it('advances to the next element on Tab', () => {
		const h = harness({ hasSelection: true, selectedIds: ['a'] });
		h.editor.slides.set(slidesWith(['a', 'b', 'c']));
		h.press('Tab');
		expect(h.editor.select).toHaveBeenCalledWith(['b']);
	});

	it('moves to the previous element on Shift+Tab', () => {
		const h = harness({ hasSelection: true, selectedIds: ['b'] });
		h.editor.slides.set(slidesWith(['a', 'b', 'c']));
		h.press('Tab', { shiftKey: true });
		expect(h.editor.select).toHaveBeenCalledWith(['a']);
	});

	it('does not cycle while editing text', () => {
		const h = harness({ hasSelection: false, isEditingText: true });
		h.editor.slides.set(slidesWith(['a', 'b']));
		h.press('Tab');
		expect(h.editor.select).not.toHaveBeenCalled();
	});

	it('leaves Tab on a chrome button to the browser focus order', () => {
		const h = harness({ hasSelection: false });
		h.editor.slides.set(slidesWith(['a', 'b']));
		const button = document.createElement('button');
		document.body.appendChild(button);
		const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
		Object.defineProperty(event, 'target', { value: button });
		h.service.handleKeyDown(event);
		expect(h.editor.select).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeFalsy();
		button.remove();
	});
});
