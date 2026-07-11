import type { InsertKind } from '../editor/editor-insert';
import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { ButtonHandle, ColorControlHandle, NumberFieldHandle } from './controls';
import { makeButton, makeColorControl, makeNumberField } from './controls';
import { createInsertMenu } from './insert-menu';

/** The formatting / arrange / insert actions the toolbar dispatches. */
export interface FormatToolbarHandlers {
	toggleBold(): void;
	toggleItalic(): void;
	toggleUnderline(): void;
	changeFontSize(delta: number): void;
	setFontSize(size: number): void;
	setTextColor(color: string): void;
	setHighlightColor(color: string): void;
	setShapeFill(color: string): void;
	setShapeStroke(color: string): void;
	bringForward(): void;
	sendBackward(): void;
	bringToFront(): void;
	sendToBack(): void;
	insert(kind: InsertKind): void;
	insertImage(): void;
}

/** The selection-derived state the toolbar reflects (enable/disable + values). */
export interface FormatSelectionState {
	hasSelection: boolean;
	canText: boolean;
	canShape: boolean;
	bold: boolean;
	italic: boolean;
	underline: boolean;
	fontSize: number;
	textColor: string | undefined;
	highlightColor: string | undefined;
	fillColor: string | undefined;
	strokeColor: string | undefined;
}

export interface FormatToolbar {
	el: HTMLElement;
	/** Reflect the current selection (enable/disable controls + seed values). */
	update(state: FormatSelectionState): void;
	/** Show/hide the whole row (editing mode on/off). */
	setEditable(editable: boolean): void;
}

const FONT_STEP = 2;

/**
 * The editing format toolbar: a single wrappable row with an Insert menu, the
 * text-format cluster (bold / italic / underline, font size stepper + input,
 * font + highlight colour), the shape-format cluster (fill + outline colour),
 * and the arrange cluster (z-order). A pragmatic stand-in for the React/Vue
 * multi-tab ribbon that covers the high-value editing actions; all labels come
 * from the shared `pptx.*` dictionary.
 */
export function createFormatToolbar(
	doc: Document,
	t: Translator,
	handlers: FormatToolbarHandlers,
): FormatToolbar {
	const el = createEl(doc, 'div', 'pptxv-format-toolbar');
	el.setAttribute('role', 'toolbar');
	el.setAttribute('aria-label', t('pptx.ribbon.home'));

	const group = (): HTMLElement => {
		const g = createEl(doc, 'span', 'pptxv-format-group');
		el.appendChild(g);
		return g;
	};

	// -- Insert -----------------------------------------------------------------
	const insertGroup = group();
	const insertMenu = createInsertMenu(doc, t, handlers);
	insertGroup.appendChild(insertMenu.el);

	// -- Text format ------------------------------------------------------------
	const textGroup = group();
	const bold = makeButton(doc, {
		label: t('pptx.textPanel.bold'),
		text: 'B',
		className: 'pptxv-glyph pptxv-glyph-bold',
		onClick: handlers.toggleBold,
	});
	const italic = makeButton(doc, {
		label: t('pptx.textPanel.italic'),
		text: 'I',
		className: 'pptxv-glyph pptxv-glyph-italic',
		onClick: handlers.toggleItalic,
	});
	const underline = makeButton(doc, {
		label: t('pptx.textPanel.underline'),
		text: 'U',
		className: 'pptxv-glyph pptxv-glyph-underline',
		onClick: handlers.toggleUnderline,
	});
	const shrink = makeButton(doc, {
		label: t('pptx.text.decreaseFontSize'),
		icon: 'minus',
		onClick: () => handlers.changeFontSize(-FONT_STEP),
	});
	const fontSize = makeNumberField(doc, {
		label: t('pptx.textPanel.size'),
		min: 1,
		max: 400,
		onCommit: (value) => handlers.setFontSize(value),
	});
	fontSize.el.classList.add('pptxv-field-compact');
	const grow = makeButton(doc, {
		label: t('pptx.text.increaseFontSize'),
		icon: 'plus',
		onClick: () => handlers.changeFontSize(FONT_STEP),
	});
	const fontColor = makeColorControl(doc, {
		label: t('pptx.text.fontColor'),
		onInput: handlers.setTextColor,
	});
	const highlight = makeColorControl(
		doc,
		{ label: t('pptx.text.highlightColor'), onInput: handlers.setHighlightColor },
		'#ffff00',
	);
	for (const node of [
		bold.btn,
		italic.btn,
		underline.btn,
		shrink.btn,
		fontSize.el,
		grow.btn,
		fontColor.el,
		highlight.el,
	]) {
		textGroup.appendChild(node);
	}

	// -- Shape format -----------------------------------------------------------
	const shapeGroup = group();
	const fill = makeColorControl(
		doc,
		{ label: t('pptx.drawing.shapeFill'), onInput: handlers.setShapeFill },
		'#4f86ff',
	);
	const stroke = makeColorControl(
		doc,
		{ label: t('pptx.drawing.shapeOutline'), onInput: handlers.setShapeStroke },
		'#1e3a8a',
	);
	shapeGroup.appendChild(fill.el);
	shapeGroup.appendChild(stroke.el);

	// -- Arrange (z-order) ------------------------------------------------------
	const arrangeGroup = group();
	const arrange: ButtonHandle[] = [
		makeButton(doc, {
			label: t('pptx.arrange.bringToFront'),
			icon: 'bring-front',
			onClick: handlers.bringToFront,
		}),
		makeButton(doc, {
			label: t('pptx.arrange.bringForward'),
			icon: 'bring-forward',
			onClick: handlers.bringForward,
		}),
		makeButton(doc, {
			label: t('pptx.arrange.sendBackward'),
			icon: 'send-backward',
			onClick: handlers.sendBackward,
		}),
		makeButton(doc, {
			label: t('pptx.arrange.sendToBack'),
			icon: 'send-back',
			onClick: handlers.sendToBack,
		}),
	];
	for (const b of arrange) {
		arrangeGroup.appendChild(b.btn);
	}

	const textControls: Array<ButtonHandle | ColorControlHandle | NumberFieldHandle> = [
		bold,
		italic,
		underline,
		shrink,
		fontSize,
		grow,
		fontColor,
		highlight,
	];
	const shapeControls: ColorControlHandle[] = [fill, stroke];

	return {
		el,
		update(state) {
			bold.setActive(state.bold);
			italic.setActive(state.italic);
			underline.setActive(state.underline);
			fontSize.setValue(state.fontSize);
			fontColor.setValue(state.textColor);
			highlight.setValue(state.highlightColor);
			fill.setValue(state.fillColor);
			stroke.setValue(state.strokeColor);
			for (const c of textControls) {
				c.setDisabled(!state.canText);
			}
			for (const c of shapeControls) {
				c.setDisabled(!state.canShape);
			}
			for (const b of arrange) {
				b.setDisabled(!state.hasSelection);
			}
			insertMenu.setDisabled(false);
		},
		setEditable(editable) {
			el.hidden = !editable;
		},
	};
}
