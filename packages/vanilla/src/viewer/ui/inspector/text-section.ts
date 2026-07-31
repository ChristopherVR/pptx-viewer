import type { TextAdvancedChanges } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { makeNumberField } from '../controls';
import { makeCheckboxField, makeSelectField } from './controls-extra';
import { createTextEffectsControls } from './text-effects-controls';
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
	const number = (label: string, key: keyof TextAdvancedChanges, min?: number) =>
		makeNumberField(doc, {
			label,
			min,
			onCommit: (value) => handlers.setTextAdvanced({ [key]: value }),
		});
	const characterSpacing = number(t('pptx.textAdvanced.characterSpacing'), 'characterSpacing');
	const lineSpacing = number(t('pptx.textAdvanced.lineSpacing'), 'lineSpacing', 0);
	const exactSpacing = number(t('pptx.textAdvanced.lineSpacingExact'), 'lineSpacingExactPt', 0);
	const spacingBefore = number(t('pptx.textAdvanced.spaceBefore'), 'paragraphSpacingBefore', 0);
	const spacingAfter = number(t('pptx.textAdvanced.spaceAfter'), 'paragraphSpacingAfter', 0);
	const indent = number(t('pptx.textAdvanced.indent'), 'paragraphIndent');
	const margin = number(t('pptx.textAdvanced.marginLeft'), 'paragraphMarginLeft');
	const direction = makeSelectField(doc, {
		label: t('pptx.textAdvanced.direction'),
		options: [
			'horizontal',
			'vertical',
			'vertical270',
			'eaVert',
			'wordArtVert',
			'wordArtVertRtl',
			'mongolianVert',
		].map((value) => ({ value, label: t(`pptx.textAdvanced.direction.${value}`) })),
		onChange: (textDirection) =>
			handlers.setTextAdvanced({
				textDirection: textDirection as NonNullable<TextAdvancedChanges['textDirection']>,
			}),
	});
	const rtl = makeCheckboxField(doc, {
		label: t('pptx.textAdvanced.rtl'),
		onChange: (enabled) => handlers.setTextAdvanced({ rtl: enabled }),
	});
	const advanced = [
		characterSpacing,
		lineSpacing,
		exactSpacing,
		spacingBefore,
		spacingAfter,
		indent,
		margin,
	];
	el.append(...advanced.map(({ el: node }) => node), direction.el, rtl.el);
	const effects = createTextEffectsControls(doc, t, handlers);
	el.appendChild(effects.el);

	const gated = [vAlign, wrap, autoFit, ...advanced, direction, rtl];

	return {
		el,
		update(state) {
			el.hidden = !state.hasSelection || !state.canText;
			vAlign.setValue(state.vAlign);
			wrap.setValue(state.textWrap === 'square');
			autoFit.setValue(state.autoFitMode);
			characterSpacing.setValue(state.characterSpacing);
			lineSpacing.setValue(state.lineSpacing);
			exactSpacing.setValue(state.lineSpacingExactPt ?? 0);
			spacingBefore.setValue(state.paragraphSpacingBefore);
			spacingAfter.setValue(state.paragraphSpacingAfter);
			indent.setValue(state.paragraphIndent);
			margin.setValue(state.paragraphMarginLeft);
			direction.setValue(state.textDirection);
			rtl.setValue(state.textRtl);
			effects.update(state);
			for (const c of gated) {
				c.setDisabled(!state.canText);
			}
		},
	};
}
