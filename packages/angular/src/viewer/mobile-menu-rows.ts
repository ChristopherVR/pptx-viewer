/**
 * mobile-menu-rows.ts: pure row-list builder for {@link MobileMenuSheetComponent}.
 *
 * Extracted out of the component so the `hiddenActions` filtering (which rows
 * get built at all) is unit-testable without Angular's TestBed/DOM (this
 * package has no component-render harness yet, see `vitest.config.ts`).
 */
import { isActionHidden } from '../internal/shared';
import type { ToolbarActionId } from '../internal/shared';

/** Descriptor for a single menu row. */
export interface MobileMenuRow {
	key: string;
	labelKey: string;
	sublabelKey?: string;
	/** SVG path data (24 x 24 view-box). */
	svgPath: string;
	disabled?: boolean;
	active?: boolean;
	danger?: boolean;
	emit: () => void;
}

/** Callbacks the built rows dispatch to; one per possible row. */
export interface MobileMenuRowActions {
	insertText: () => void;
	openFind: () => void;
	openSorter: () => void;
	toggleNotes: () => void;
	present: () => void;
	exportPng: () => void;
	exportPdf: () => void;
	exportGif: () => void;
	exportVideo: () => void;
	openFile: () => void;
	savePptx: () => void;
	print: () => void;
}

/** Inputs that shape which rows are built/enabled. */
export interface MobileMenuRowParams {
	slideCount: number;
	exporting: boolean;
	showNotes: boolean;
	canEdit: boolean;
	hiddenActions: readonly ToolbarActionId[] | undefined;
}

/**
 * Builds the mobile-menu row list, dropping rows whose action id is in
 * `hiddenActions` ('notes' for the Speaker Notes row, 'export' for the four
 * export rows). Everything else always renders, matching prior behaviour.
 */
export function buildMobileMenuRows(
	params: MobileMenuRowParams,
	actions: MobileMenuRowActions,
): MobileMenuRow[] {
	const { slideCount: count, exporting: exp, showNotes, canEdit: editable, hiddenActions } = params;
	const noSlides = count === 0;
	const hidden = (id: ToolbarActionId): boolean => isActionHidden(id, hiddenActions);

	return [
		...(editable
			? [
					{
						key: 'insert-text',
						labelKey: 'pptx.mobileMenu.insertTextBox',
						svgPath: 'M12 5v14 M5 12h14',
						disabled: noSlides,
						emit: actions.insertText,
					},
				]
			: []),
		{
			key: 'find',
			labelKey: 'pptx.mobileMenu.find',
			svgPath: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
			disabled: noSlides,
			emit: actions.openFind,
		},
		{
			key: 'sorter',
			labelKey: 'pptx.mobileMenu.sorter',
			svgPath: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
			disabled: noSlides,
			emit: actions.openSorter,
		},
		...(hidden('notes')
			? []
			: [
					{
						key: 'notes',
						labelKey: 'pptx.mobileMenu.speakerNotes',
						svgPath:
							'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z',
						disabled: noSlides,
						active: showNotes,
						emit: actions.toggleNotes,
					},
				]),
		{
			key: 'present',
			labelKey: 'pptx.mobileMenu.present',
			svgPath: 'M5 3l14 9-14 9V3z',
			disabled: noSlides,
			emit: actions.present,
		},
		...(hidden('export')
			? []
			: [
					{
						key: 'export-png',
						labelKey: 'pptx.mobileMenu.exportPng',
						sublabelKey: 'pptx.mobileMenu.currentSlide',
						svgPath:
							'M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
						disabled: noSlides || exp,
						emit: actions.exportPng,
					},
					{
						key: 'export-pdf',
						labelKey: exp ? 'pptx.mobileMenu.exporting' : 'pptx.mobileMenu.exportPdf',
						sublabelKey: 'pptx.mobileMenu.allSlides',
						svgPath:
							'M7 21h10a2 2 0 0 0 2-2V9.414a1 1 0 0 0-.293-.707l-5.414-5.414A1 1 0 0 0 12.586 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z',
						disabled: noSlides || exp,
						emit: actions.exportPdf,
					},
					{
						key: 'export-gif',
						labelKey: 'pptx.mobileMenu.exportGif',
						sublabelKey: 'pptx.mobileMenu.animated',
						svgPath:
							'M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z',
						disabled: noSlides || exp,
						emit: actions.exportGif,
					},
					{
						key: 'export-video',
						labelKey: 'pptx.mobileMenu.exportVideo',
						sublabelKey: 'pptx.mobileMenu.mp4',
						svgPath:
							'M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z',
						disabled: noSlides || exp,
						emit: actions.exportVideo,
					},
				]),
		{
			key: 'open-file',
			labelKey: 'pptx.mobileMenu.open',
			sublabelKey: 'pptx.mobileMenu.pptxExt',
			svgPath: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
			disabled: false,
			emit: actions.openFile,
		},
		{
			key: 'save-pptx',
			labelKey: 'pptx.mobileMenu.save',
			sublabelKey: 'pptx.mobileMenu.pptxExt',
			svgPath: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
			disabled: noSlides,
			emit: actions.savePptx,
		},
		{
			key: 'print',
			labelKey: 'pptx.mobileMenu.print',
			svgPath:
				'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6v-8z',
			disabled: noSlides,
			emit: actions.print,
		},
	];
}
