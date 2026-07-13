import type { PptxElement } from 'pptx-viewer-core';

import type { EditActions } from '../../../editor/editor-edit-ops';
import { canFormatText, readTextFormatState } from '../../../editor/editor-format-mutations';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { ArrangeGroup } from './arrange-group';
import { createArrangeGroup } from './arrange-group';
import type { ClipboardGroup } from './clipboard-group';
import { createClipboardGroup } from './clipboard-group';
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
}

export interface HomeTab {
	el: HTMLElement;
	update(state: HomeTabSyncState): void;
}

/** Composes the Home tab's six groups: Clipboard, Slides, Font, Paragraph, Arrange, Editing. */
export function createHomeTab(doc: Document, t: Translator, deps: HomeTabDeps): HomeTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const { edit } = deps;

	const clipboard: ClipboardGroup = createClipboardGroup(doc, t, {
		copy: edit.copy,
		cut: edit.cut,
		paste: edit.paste,
		duplicate: edit.duplicateSelected,
		delete: edit.deleteSelected,
	});
	const slides: SlidesGroup = createSlidesGroup(doc, t, {
		addSlide: edit.addSlide,
		duplicateSlide: edit.duplicateSlide,
		deleteSlide: edit.deleteSlide,
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
	});
	const arrange: ArrangeGroup = createArrangeGroup(doc, t, {
		bringForward: edit.bringForward,
		sendBackward: edit.sendBackward,
		bringToFront: edit.bringToFront,
		sendToBack: edit.sendToBack,
		alignElements: edit.alignElements,
		flipHorizontal: edit.flipHorizontal,
		flipVertical: edit.flipVertical,
		groupSelected: edit.groupSelected,
		ungroupSelected: edit.ungroupSelected,
		duplicate: edit.duplicateSelected,
		delete: edit.deleteSelected,
	});
	const editing: EditingGroup = createEditingGroup(doc, t, {
		toggleFindReplace: deps.onToggleFindReplace,
	});

	el.append(clipboard.el, slides.el, font.el, paragraph.el, arrange.el, editing.el);

	return {
		el,
		update({ editable, selectedElement, hasClipboard, slideCount, selectedCount }) {
			const canFormat = canFormatText(selectedElement);
			const text = readTextFormatState(selectedElement);
			clipboard.update({ hasSelection: selectedElement !== undefined, hasClipboard, editable });
			slides.update({ editable, slideCount });
			font.update({ canFormat, editable, text });
			paragraph.update({ canFormat, editable, text });
			arrange.update({
				editable,
				hasSelection: selectedElement !== undefined,
				isGroup: selectedElement?.type === 'group',
				selectedCount,
			});
		},
	};
}
