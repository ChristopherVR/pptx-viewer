import { HIGHLIGHTER_COLORS, PEN_COLORS, presentToolbarCssVars } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { ButtonHandle } from './controls';
import { makeButton } from './controls';
import { createIcon } from './icons';
import type { IconName } from './icons';
import type { PresentationToolbarHandlers } from './presentation-toolbar';
import type { ColorPalette } from './presentation-toolbar-palette';
import { createColorPalette } from './presentation-toolbar-palette';

/**
 * DOM assembly for the slide-show toolbar.
 *
 * Split from `presentation-toolbar.ts` so neither file exceeds the repo's 300
 * LOC ceiling: this module owns the element tree (order, ids, icons, accessible
 * names), and the other owns the behaviour (state reflection, auto-hide, the
 * elapsed timer). Nothing here reads or writes toolbar state.
 *
 * Icon names are this binding's own (`ui/icons.ts`) rather than the shared
 * inventory's Lucide names: the zero-dependency bundle carries hand-written path
 * data, so `mouse-pointer-2` is `cursor`, `pen-tool` is `pen`, `trash-2` is
 * `trash` and `x` is `close`. Only the glyph source differs; the control id and
 * the i18n key both come straight from the shared inventory.
 */

/** A tool toggle plus its colour caret and popover (pen and highlighter). */
export interface ToolGroup {
	el: HTMLElement;
	toggle: ButtonHandle;
	palette: ColorPalette;
	/** Underline tinted with the tool's current colour. */
	bar: HTMLElement;
}

/** Every node the behaviour layer has to address. */
export interface PresentationToolbarParts {
	/** Auto-hiding positioner; carries the shared metrics as custom properties. */
	wrap: HTMLElement;
	/** The bar itself (`role="toolbar"`). */
	bar: HTMLElement;
	previous: ButtonHandle;
	counter: HTMLElement;
	next: ButtonHandle;
	elapsedText: HTMLElement;
	laser: ButtonHandle;
	pen: ToolGroup;
	highlighter: ToolGroup;
	eraser: ButtonHandle;
	blackboard: ButtonHandle;
	clear: ButtonHandle;
	presenterView: ButtonHandle;
	end: ButtonHandle;
	closePalettes(): void;
}

/** Build one labelled bar button carrying its `data-pptx-present-control` id. */
function control(
	doc: Document,
	t: Translator,
	spec: { id: string; labelKey: string; icon: IconName; className?: string; onClick(): void },
): ButtonHandle {
	const handle = makeButton(doc, {
		label: t(spec.labelKey),
		icon: spec.icon,
		className: `pptxv-present-btn${spec.className ? ` ${spec.className}` : ''}`,
		onClick: spec.onClick,
	});
	handle.btn.dataset.pptxPresentControl = spec.id;
	return handle;
}

interface ToolGroupSpec {
	id: 'pen' | 'highlighter';
	labelKey: string;
	icon: IconName;
	caretLabelKey: string;
	colors: readonly string[];
	swatchLabelKey: string;
	onSelect(): void;
	onPick(color: string): void;
	onCaret(): void;
}

function toolGroup(doc: Document, t: Translator, spec: ToolGroupSpec): ToolGroup {
	const el = createEl(doc, 'div', 'pptxv-present-group');
	const toggle = control(doc, t, {
		id: spec.id,
		labelKey: spec.labelKey,
		icon: spec.icon,
		onClick: spec.onSelect,
	});
	const bar = createEl(doc, 'span', 'pptxv-present-swatch-bar');
	toggle.btn.appendChild(bar);
	const caret = control(doc, t, {
		id: `${spec.id}-color`,
		labelKey: spec.caretLabelKey,
		icon: 'chevron-down',
		className: 'pptxv-present-caret',
		onClick: spec.onCaret,
	});
	const palette = createColorPalette(doc, t, {
		colors: spec.colors,
		swatchLabelKey: spec.swatchLabelKey,
		onPick: spec.onPick,
	});
	el.append(toggle.btn, caret.btn, palette.el);
	return { el, toggle, palette, bar };
}

/**
 * Build the toolbar's element tree.
 *
 * `onPickColor` fires after the module has already closed the palette and told
 * the handlers to adopt the colour + tool, so the caller only has to remember
 * the choice and re-render its underline.
 */
export function buildPresentationToolbarDom(
	doc: Document,
	t: Translator,
	handlers: PresentationToolbarHandlers,
	onPickColor: (tool: 'pen' | 'highlighter', color: string) => void,
): PresentationToolbarParts {
	const wrap = createEl(doc, 'div', 'pptxv-present-toolbar-wrap');
	for (const [name, value] of Object.entries(presentToolbarCssVars())) {
		wrap.style.setProperty(name, value);
	}
	const bar = createEl(doc, 'div', 'pptxv-present-toolbar');
	bar.setAttribute('data-pptx-present-toolbar', '');
	bar.setAttribute('role', 'toolbar');
	bar.setAttribute('aria-label', t('pptx.toolbar.presentationToolbarAria'));
	wrap.appendChild(bar);

	const divider = (id: string): HTMLElement => {
		const el = createEl(doc, 'div', 'pptxv-present-divider');
		el.dataset.pptxPresentControl = id;
		return el;
	};

	const previous = control(doc, t, {
		id: 'previous',
		labelKey: 'pptx.presenter.previousSlide',
		icon: 'chevron-left',
		onClick: handlers.previous,
	});
	const counter = createEl(doc, 'span', 'pptxv-present-counter');
	counter.dataset.pptxPresentControl = 'counter';
	const next = control(doc, t, {
		id: 'next',
		labelKey: 'pptx.presenter.nextSlide',
		icon: 'chevron-right',
		onClick: handlers.next,
	});
	const timer = createEl(doc, 'div', 'pptxv-present-timer');
	timer.dataset.pptxPresentControl = 'timer';
	timer.title = t('pptx.presenter.elapsed');
	timer.setAttribute('aria-label', t('pptx.presenter.elapsed'));
	const elapsedText = createEl(doc, 'span', 'pptxv-present-elapsed');
	timer.append(createIcon(doc, 'timer'), elapsedText);
	const laser = control(doc, t, {
		id: 'laser',
		labelKey: 'pptx.presentation.laserPointer',
		icon: 'cursor',
		onClick: () => handlers.setTool('laser'),
	});

	// At most one palette is open at a time, tracked here rather than read back
	// off the two popovers so a caret cannot both close and reopen itself.
	let openPalette: 'pen' | 'highlighter' | null = null;
	const syncPalettes = (): void => {
		pen.palette.setOpen(openPalette === 'pen');
		highlighter.palette.setOpen(openPalette === 'highlighter');
	};
	const closePalettes = (): void => {
		openPalette = null;
		syncPalettes();
	};
	const group = (spec: Omit<ToolGroupSpec, 'onSelect' | 'onPick' | 'onCaret'>): ToolGroup =>
		toolGroup(doc, t, {
			...spec,
			onSelect: () => {
				closePalettes();
				handlers.setTool(spec.id);
			},
			// Picking a colour is also "draw with this", matching React: a presenter
			// who reaches for red expects the pen, not a colour they must then arm.
			onPick: (color) => {
				closePalettes();
				handlers.setColor(color);
				handlers.setTool(spec.id);
				onPickColor(spec.id, color);
			},
			onCaret: () => {
				openPalette = openPalette === spec.id ? null : spec.id;
				syncPalettes();
			},
		});
	const pen: ToolGroup = group({
		id: 'pen',
		labelKey: 'pptx.presentation.pen',
		icon: 'pen',
		caretLabelKey: 'pptx.presentationToolbar.penColor',
		colors: PEN_COLORS,
		swatchLabelKey: 'pptx.presentationToolbar.penColorValue',
	});
	const highlighter: ToolGroup = group({
		id: 'highlighter',
		labelKey: 'pptx.presentation.highlighter',
		icon: 'highlighter',
		caretLabelKey: 'pptx.presentationToolbar.highlighterColor',
		colors: HIGHLIGHTER_COLORS,
		swatchLabelKey: 'pptx.presentationToolbar.highlighterColorValue',
	});
	const eraser = control(doc, t, {
		id: 'eraser',
		labelKey: 'pptx.presentation.eraser',
		icon: 'eraser',
		onClick: () => {
			closePalettes();
			handlers.setTool('eraser');
		},
	});
	const blackboard = control(doc, t, {
		id: 'blackboard',
		labelKey: 'pptx.presentation.blackboard',
		icon: 'presentation',
		onClick: () => {
			closePalettes();
			handlers.toggleBlackboard();
		},
	});
	const clear = control(doc, t, {
		id: 'clear',
		labelKey: 'pptx.presentation.clearAnnotations',
		icon: 'trash',
		className: 'pptxv-present-danger',
		onClick: handlers.clearAnnotations,
	});
	const presenterView = control(doc, t, {
		id: 'presenter-view',
		labelKey: 'pptx.presenter.presenterView',
		icon: 'panel-right',
		onClick: handlers.togglePresenterView,
	});
	const end = control(doc, t, {
		id: 'end',
		labelKey: 'pptx.presenter.endPresentation',
		icon: 'close',
		className: 'pptxv-present-danger',
		onClick: handlers.end,
	});
	bar.append(
		previous.btn,
		counter,
		next.btn,
		divider('divider-navigation'),
		timer,
		divider('divider-timer'),
		laser.btn,
		pen.el,
		highlighter.el,
		eraser.btn,
		blackboard.btn,
		clear.btn,
		divider('divider-tools'),
		presenterView.btn,
		end.btn,
	);

	// A click anywhere on the bar must never reach the stage's click-to-advance
	// handler on the viewer root, which would skip a slide on every button press.
	for (const type of ['pointerdown', 'click'] as const) {
		bar.addEventListener(type, (event: Event) => event.stopPropagation());
	}

	return {
		wrap,
		bar,
		previous,
		counter,
		next,
		elapsedText,
		laser,
		pen,
		highlighter,
		eraser,
		blackboard,
		clear,
		presenterView,
		end,
		closePalettes,
	};
}
