import type { SlideBackgroundActions } from '../../editor/editor-background-actions';
import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeButton, makeColorControl } from '../controls';

export interface FormatBackgroundPanel {
	el: HTMLElement;
	toggle(): void;
	setOpen(open: boolean): void;
	isOpen(): boolean;
	setEditable(editable: boolean): void;
}

/**
 * A simple docked "Format Background" panel (solid colour fill only, matching
 * the docked-panel idiom of `find-replace-panel.ts` / `equation-panel.ts`
 * rather than React's inspector-pane version). Applies immediately on colour
 * pick via {@link SlideBackgroundActions}; the panel doesn't reflect the
 * current slide's existing background (it's a write-only applier, same as
 * the Transitions/Animations galleries).
 */
export function createFormatBackgroundPanel(
	doc: Document,
	t: Translator,
	actions: Pick<SlideBackgroundActions, 'setSlideBackgroundColor' | 'clearSlideBackground'>,
): FormatBackgroundPanel {
	const el = createEl(doc, 'div', 'pptxv-format-background-panel');
	el.hidden = true;
	el.setAttribute('role', 'dialog');
	el.setAttribute('aria-label', t('pptx.ribbon.formatBackground'));

	const colorControl = makeColorControl(
		doc,
		{
			label: t('pptx.slideBackground.colourAriaLabel'),
			onInput: (hex) => actions.setSlideBackgroundColor(hex),
		},
		'#ffffff',
	);

	const clearBtn = makeButton(doc, {
		label: t('pptx.slideBackground.clearBackground'),
		text: t('pptx.slideBackground.clearBackground'),
		onClick: () => actions.clearSlideBackground(),
	});
	const closeBtn = makeButton(doc, {
		label: t('pptx.findReplace.closeAriaLabel'),
		icon: 'chevron-up',
		onClick: () => setOpen(false),
	});

	const row = createEl(doc, 'div', 'pptxv-format-background-row');
	const label = createEl(doc, 'span', 'pptxv-format-background-label');
	label.textContent = t('pptx.slideBackground.colour');
	row.append(label, colorControl.el, clearBtn.btn, closeBtn.btn);
	el.appendChild(row);

	let open = false;
	const setOpen = (next: boolean): void => {
		open = next;
		el.hidden = !open;
	};

	return {
		el,
		toggle: () => setOpen(!open),
		setOpen,
		isOpen: () => open,
		setEditable(editable) {
			colorControl.setDisabled(!editable);
			clearBtn.setDisabled(!editable);
		},
	};
}
