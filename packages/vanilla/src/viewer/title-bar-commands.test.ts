import { COMMAND_SEARCH_ENTRIES } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import type { EditActions } from './editor/editor-edit-ops';
import { runTitleBarCommand } from './title-bar-commands';
import type { TitleBarCommandDeps } from './title-bar-commands';
import type { Ribbon } from './ui/ribbon/ribbon-api';

function make() {
	const edit = {
		patchSelectedTextStyle: vi.fn(),
		insert: vi.fn(),
		insertImage: vi.fn(() => Promise.resolve()),
		insertMedia: vi.fn(() => Promise.resolve()),
		insertChart: vi.fn(),
		toggleViewOption: vi.fn(),
		bringToFront: vi.fn(),
		sendToBack: vi.fn(),
		duplicateSelected: vi.fn(),
		toggleSpellCheck: vi.fn(),
	};
	const ribbon = {
		openSmartArtDialog: vi.fn(),
		toggleEquationPanel: vi.fn(),
		toggleThemeGallery: vi.fn(),
		openSlideSize: vi.fn(),
	};
	const deps = {
		edit: () => edit as unknown as EditActions,
		ribbon: () => ribbon as unknown as Ribbon,
		zoomToFit: vi.fn(),
		openSlideSorter: vi.fn(),
		openAccessibility: vi.fn(),
		openHyperlink: vi.fn(),
		startPresentationFromBeginning: vi.fn(),
		togglePresenterView: vi.fn(),
	} satisfies TitleBarCommandDeps;
	return { edit, ribbon, deps };
}

describe('runTitleBarCommand', () => {
	it('sets (not toggles) character formatting like the other bindings', () => {
		const { edit, deps } = make();
		runTitleBarCommand('format.bold', deps);
		runTitleBarCommand('format.alignCenter', deps);
		runTitleBarCommand('format.clear', deps);
		expect(edit.patchSelectedTextStyle.mock.calls).toStrictEqual([
			[{ bold: true }],
			[{ align: 'center' }],
			[{ bold: false, italic: false, underline: false, strikethrough: false }],
		]);
	});

	it('routes insert, view, arrange, slide show, design and review commands', () => {
		const { edit, ribbon, deps } = make();
		for (const id of [
			'insert.textBox',
			'insert.table',
			'insert.smartArt',
			'insert.equation',
			'view.toggleGrid',
			'view.zoomToFit',
			'arrange.duplicate',
			'slideShow.fromBeginning',
			'design.browseThemes',
			'design.slideSize',
			'review.accessibility',
		]) {
			runTitleBarCommand(id, deps);
		}
		expect(edit.insert.mock.calls).toStrictEqual([['text'], ['table']]);
		expect(edit.toggleViewOption).toHaveBeenCalledWith('showGrid');
		expect(edit.duplicateSelected).toHaveBeenCalledOnce();
		expect(ribbon.openSmartArtDialog).toHaveBeenCalledOnce();
		expect(ribbon.toggleEquationPanel).toHaveBeenCalledOnce();
		expect(ribbon.toggleThemeGallery).toHaveBeenCalledOnce();
		expect(ribbon.openSlideSize).toHaveBeenCalledOnce();
		expect(deps.zoomToFit).toHaveBeenCalledOnce();
		expect(deps.startPresentationFromBeginning).toHaveBeenCalledOnce();
		expect(deps.openAccessibility).toHaveBeenCalledOnce();
	});

	it('handles every shared catalogue id except the actionless Language entry', () => {
		const { deps } = make();
		const unhandled = COMMAND_SEARCH_ENTRIES.filter((entry) => {
			const probe = make();
			// A handled id touches at least one dependency; an unknown id touches none.
			runTitleBarCommand(entry.command, probe.deps);
			const touched = [
				...Object.values(probe.edit),
				...Object.values(probe.ribbon),
				probe.deps.zoomToFit,
				probe.deps.openSlideSorter,
				probe.deps.openAccessibility,
				probe.deps.openHyperlink,
				probe.deps.startPresentationFromBeginning,
				probe.deps.togglePresenterView,
			].some((fn) => fn.mock.calls.length > 0);
			return !touched;
		}).map((entry) => entry.command);
		expect(unhandled).toStrictEqual(['review.language']);
		expect(deps).toBeDefined();
	});
});
