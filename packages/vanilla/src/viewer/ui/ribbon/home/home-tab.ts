import type { PptxElement } from 'pptx-viewer-core';

import type { EditActions } from '../../../editor/editor-edit-ops';
import { canFormatText, readTextFormatState } from '../../../editor/editor-format-mutations';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { LayoutOption } from '../ribbon-types';
import type { ArrangeGroup } from './arrange-group';
import { createArrangeGroup } from './arrange-group';
import type { ClipboardGroup } from './clipboard-group';
import { createClipboardGroup } from './clipboard-group';
import type { DrawingGroup } from './drawing-group';
import { createDrawingGroup } from './drawing-group';
import type { EditingGroup } from './editing-group';
import { createEditingGroup } from './editing-group';
import type { FontGroup } from './font-group';
import { createFontGroup } from './font-group';
import type { ParagraphGroup } from './paragraph-group';
import { createParagraphGroup } from './paragraph-group';
import type { SlidesGroup } from './slides-group';
import { createSlidesGroup } from './slides-group';

export interface HomeTabDeps {
	edit: EditActions;
	onToggleFindReplace(): void;
}

export interface HomeTabSyncState {
	editable: boolean;
	selectedElement: PptxElement | undefined;
	hasClipboard: boolean;
	slideCount: number;
	selectedCount: number;
	formatPainterActive: boolean;
	layouts: readonly LayoutOption[];
}

export interface HomeTab {
	el: HTMLElement;
	update(state: HomeTabSyncState): void;
}

/**
 * Composes the Home tab's seven groups: Clipboard, Slides, Font, Paragraph,
 * Editing, Drawing, Arrange (React's order).
 */
export function createHomeTab(doc: Document, t: Translator, deps: HomeTabDeps): HomeTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const { edit } = deps;

	const clipboard: ClipboardGroup = createClipboardGroup(doc, t, {
		copy: edit.copy,
		cut: edit.cut,
		paste: edit.paste,
		toggleFormatPainter: edit.toggleFormatPainter,
	});
	const slides: SlidesGroup = createSlidesGroup(doc, t, {
		addSlide: edit.addSlide,
		insertSlideFromLayout: edit.insertSlideFromLayout,
		insertSlideFromTemplate: edit.insertSlideFromTemplate,
		applyLayout: edit.applyLayout,
		resetSlide: edit.resetSlide,
		addSection: () => edit.sections.addSection(t('pptx.sections.defaultName')),
		getTemplateScheme: () => edit.getTemplateScheme(),
	});
	const font: FontGroup = createFontGroup(doc, t, {
		toggleBold: edit.toggleBold,
		toggleItalic: edit.toggleItalic,
		toggleUnderline: edit.toggleUnderline,
		toggleStrikethrough: edit.toggleStrikethrough,
		toggleTextShadow: edit.toggleTextShadow,
		setFontFamily: edit.setFontFamily,
		setFontSize: edit.setFontSize,
		changeFontSize: edit.changeFontSize,
		setTextColor: edit.setTextColor,
		setHighlightColor: edit.setHighlightColor,
		setCharacterSpacing: edit.setCharacterSpacing,
		changeCase: edit.changeCase,
		clearFormatting: edit.clearFormatting,
	});
	const paragraph: ParagraphGroup = createParagraphGroup(doc, t, {
		toggleBulletList: edit.toggleBulletList,
		toggleNumberedList: edit.toggleNumberedList,
		increaseIndent: edit.increaseIndent,
		decreaseIndent: edit.decreaseIndent,
		setTextAlign: edit.setTextAlign,
		setLineSpacing: edit.setLineSpacing,
		setTextDirection: edit.setTextDirection,
		setColumnCount: edit.setColumnCount,
	});
	const editing: EditingGroup = createEditingGroup(doc, t, {
		toggleFindReplace: deps.onToggleFindReplace,
		selectAll: edit.selectAll,
	});
	const drawing: DrawingGroup = createDrawingGroup(doc, t, {
		insertShape: (shapeType) => edit.insert('shape', shapeType),
		bringForward: edit.bringForward,
		sendBackward: edit.sendBackward,
		bringToFront: edit.bringToFront,
		sendToBack: edit.sendToBack,
		groupSelected: edit.groupSelected,
		ungroupSelected: edit.ungroupSelected,
		setShapeFill: edit.setShapeFill,
		setShapeStroke: edit.setShapeStroke,
	});
	const arrange: ArrangeGroup = createArrangeGroup(doc, t, {
		bringForward: edit.bringForward,
		sendBackward: edit.sendBackward,
		bringToFront: edit.bringToFront,
		sendToBack: edit.sendToBack,
		alignElements: edit.alignElements,
		distributeElements: edit.distributeElements,
		flipHorizontal: edit.flipHorizontal,
		flipVertical: edit.flipVertical,
		groupSelected: edit.groupSelected,
		ungroupSelected: edit.ungroupSelected,
		setStrokeWidth: edit.setShapeStrokeWidth,
		toggleFormatPainter: edit.toggleFormatPainter,
		duplicate: edit.duplicateSelected,
		delete: edit.deleteSelected,
	});

	el.append(clipboard.el, slides.el, font.el, paragraph.el, editing.el, drawing.el, arrange.el);

	return {
		el,
		update({
			editable,
			selectedElement,
			hasClipboard,
			slideCount,
			selectedCount,
			formatPainterActive,
			layouts,
		}) {
			const canFormat = canFormatText(selectedElement);
			const text = readTextFormatState(selectedElement);
			const hasSelection = selectedElement !== undefined;
			clipboard.update({ hasSelection, hasClipboard, editable, formatPainterActive });
			slides.update({ editable, slideCount, layouts });
			font.update({ canFormat, editable, text });
			paragraph.update({ canFormat, editable, text });
			editing.update({ editable });
			drawing.update({ editable, hasSelection });
			arrange.update({
				editable,
				hasSelection,
				formatPainterActive,
				selectedCount,
				selectedElement,
			});
		},
	};
}
