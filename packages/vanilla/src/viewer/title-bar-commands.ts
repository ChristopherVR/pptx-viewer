import type { EditActions } from './editor/editor-edit-ops';
import type { Ribbon } from './ui/ribbon/ribbon-api';

/** What the title bar's command search drives; every member already exists in the chrome. */
export interface TitleBarCommandDeps {
	edit(): EditActions;
	ribbon(): Ribbon | null | undefined;
	zoomToFit(): void;
	openSlideSorter(): void;
	openAccessibility(): void;
	openHyperlink(): void;
	startPresentationFromBeginning(): void;
	togglePresenterView?(): void;
}

const CLEAR_FORMATTING = { bold: false, italic: false, underline: false, strikethrough: false };

/**
 * Run a shared command-search id (`COMMAND_SEARCH_ENTRIES`). The routes mirror the
 * React dispatcher entry for entry (set, not toggle, for character formatting;
 * dialog-backed commands open the ribbon's own surface). `review.language` has no
 * action in any binding.
 */
export function runTitleBarCommand(id: string, deps: TitleBarCommandDeps): void {
	const edit = deps.edit();
	const ribbon = deps.ribbon();
	const handlers: Record<string, () => void> = {
		'format.bold': () => edit.patchSelectedTextStyle({ bold: true }),
		'format.italic': () => edit.patchSelectedTextStyle({ italic: true }),
		'format.underline': () => edit.patchSelectedTextStyle({ underline: true }),
		'format.alignLeft': () => edit.patchSelectedTextStyle({ align: 'left' }),
		'format.alignCenter': () => edit.patchSelectedTextStyle({ align: 'center' }),
		'format.alignRight': () => edit.patchSelectedTextStyle({ align: 'right' }),
		'format.clear': () => edit.patchSelectedTextStyle(CLEAR_FORMATTING),
		'insert.textBox': () => edit.insert('text'),
		'insert.shape': () => edit.insert('shape'),
		'insert.image': () => void edit.insertImage(),
		'insert.media': () => void edit.insertMedia(),
		'insert.table': () => edit.insert('table'),
		'insert.chart': () => edit.insertChart(),
		'insert.smartArt': () => ribbon?.openSmartArtDialog(),
		'insert.equation': () => ribbon?.toggleEquationPanel(),
		'insert.link': () => deps.openHyperlink(),
		'view.toggleGrid': () => edit.toggleViewOption('showGrid'),
		'view.toggleRulers': () => edit.toggleViewOption('showRulers'),
		'view.slideSorter': () => deps.openSlideSorter(),
		'view.zoomToFit': () => deps.zoomToFit(),
		'slideShow.fromBeginning': () => deps.startPresentationFromBeginning(),
		'slideShow.presenterView': () => deps.togglePresenterView?.(),
		'design.browseThemes': () => ribbon?.toggleThemeGallery(),
		'design.slideSize': () => ribbon?.openSlideSize(),
		'arrange.bringToFront': () => edit.bringToFront(),
		'arrange.sendToBack': () => edit.sendToBack(),
		'arrange.duplicate': () => edit.duplicateSelected(),
		'review.spelling': () => edit.toggleSpellCheck(),
		'review.accessibility': () => deps.openAccessibility(),
	};
	handlers[id]?.();
}
