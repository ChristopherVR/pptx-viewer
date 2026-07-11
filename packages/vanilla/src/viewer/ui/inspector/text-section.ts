import type { Translator } from '../../i18n';
import { makeCheckboxField, makeSelectField } from './controls-extra';
import type { InspectorHandlers, InspectorState } from './types';

export interface TextSection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/**
 * The Text section: vertical anchor, wrap-in-shape toggle, and autofit mode.
 * Text alignment (left/center/right/justify) is already covered by the
 * ribbon's Home > Paragraph group, so it is intentionally not duplicated here.
 */
export function createTextSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
): TextSection {
	const el = section(t('pptx.inspector.text'));

	const vAlign = makeSelectField(doc, {
		label: t('pptx.textPanel.verticalAlign'),
		options: [
			{ value: 'top', label: t('pptx.textPanel.valignTop') },
			{ value: 'middle', label: t('pptx.textPanel.valignMiddle') },
			{ value: 'bottom', label: t('pptx.textPanel.valignBottom') },
		],
		onChange: handlers.setTextVerticalAlign,
	});
	el.appendChild(vAlign.el);

	const wrap = makeCheckboxField(doc, {
		label: t('pptx.textAdvanced.wrapText'),
		onChange: (checked) => handlers.setTextWrap(checked ? 'square' : 'none'),
	});
	el.appendChild(wrap.el);

	const autoFit = makeSelectField(doc, {
		label: t('pptx.textAdvanced.autoFit'),
		options: [
			{ value: 'none', label: t('pptx.textAdvanced.autoFitNone') },
			{ value: 'normal', label: t('pptx.textAdvanced.autoFitShrink') },
			{ value: 'shrink', label: t('pptx.textAdvanced.autoFitResize') },
		],
		onChange: handlers.setAutoFitMode,
	});
	el.appendChild(autoFit.el);

	const gated = [vAlign, wrap, autoFit];

	return {
		el,
		update(state) {
			el.hidden = !state.hasSelection || !state.canText;
			vAlign.setValue(state.vAlign);
			wrap.setValue(state.textWrap === 'square');
			autoFit.setValue(state.autoFitMode);
			for (const c of gated) {
				c.setDisabled(!state.canText);
			}
		},
	};
}
