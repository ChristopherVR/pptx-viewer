import { RIBBON_HOME_OBJECT_FAMILIES } from './ribbon-home-families-objects';
import { column, control, pills, strip, text } from './ribbon-home-family-helpers';
import {
	HOME_CHANGE_CASE_ITEMS,
	HOME_CHARACTER_SPACING_ITEMS,
	HOME_COLUMN_ITEMS,
	HOME_LINE_SPACING_ITEMS,
	HOME_SELECT_ITEMS,
	HOME_TEXT_DIRECTION_ITEMS,
} from './ribbon-home-menus';
import type { RibbonHomeFamily, RibbonHomeFamilySpec } from './ribbon-home-spec';

const STANDARD = { swatches: 'office', theme: true, custom: true, bar: true } as const;

export const RIBBON_HOME_FAMILIES: Readonly<Record<RibbonHomeFamily, RibbonHomeFamilySpec>> = {
	clipboard: {
		group: { id: 'home.clipboard', captionKey: 'pptx.ribbon.clipboard', fallback: 'Clipboard' },
		clusters: [
			strip(
				control('home.clipboard.paste', 'pptx.arrange.paste', 'Paste', undefined, {
					large: true,
					text: text('pptx.arrange.paste', 'Paste'),
				}),
			),
			column(
				control('home.clipboard.cut', 'pptx.arrange.cut', 'Cut', undefined, {
					text: text('pptx.arrange.cut', 'Cut'),
				}),
				control('home.clipboard.copy', 'pptx.arrange.copy', 'Copy', undefined, {
					text: text('pptx.arrange.copy', 'Copy'),
				}),
				control(
					'home.clipboard.formatPainter',
					'pptx.arrange.formatPainter',
					'Format Painter',
					'format-painter-toggle',
					{ text: text('pptx.arrange.formatPainter', 'Format Painter') },
				),
			),
		],
	},
	font: {
		clusters: [
			strip(
				control('home.font.bold', 'pptx.textPanel.bold', 'Bold'),
				control('home.font.italic', 'pptx.textPanel.italic', 'Italic'),
				control('home.font.underline', 'pptx.textPanel.underline', 'Underline'),
				control('home.font.strikethrough', 'pptx.textPanel.strikethrough', 'Strikethrough'),
			),
			strip(control('home.font.shadow', 'pptx.textEffects.shadow', 'Text Shadow')),
			strip(
				control('home.font.increaseFontSize', 'pptx.text.increaseFontSize', 'Increase Font Size'),
				control('home.font.decreaseFontSize', 'pptx.text.decreaseFontSize', 'Decrease Font Size'),
				control('home.font.clearFormatting', 'pptx.text.clearFormatting', 'Clear Formatting'),
			),
			pills(
				undefined,
				control(
					'home.font.characterSpacing',
					'pptx.text.characterSpacing',
					'Character Spacing',
					undefined,
					{ kind: 'select', select: { icon: true }, items: HOME_CHARACTER_SPACING_ITEMS },
				),
				control('home.font.changeCase', 'pptx.text.changeCase', 'Change Case', undefined, {
					kind: 'menu',
					popup: true,
					items: HOME_CHANGE_CASE_ITEMS,
				}),
				control('home.font.fontColor', 'pptx.text.fontColor', 'Font Color', undefined, {
					kind: 'colour',
					popup: true,
					colour: STANDARD,
				}),
				control(
					'home.font.highlightColor',
					'pptx.text.highlightColor',
					'Text Highlight Color',
					undefined,
					{
						kind: 'colour',
						popup: true,
						colour: { swatches: 'highlight', custom: true, bar: true },
					},
				),
			),
		],
	},
	paragraph: {
		clusters: [
			pills(
				undefined,
				control('home.paragraph.bullets', 'pptx.text.bulletList', 'Bullet List', undefined, {
					gallery: { id: 'bullets' },
				}),
				control('home.paragraph.numbering', 'pptx.text.numberedList', 'Numbered List', undefined, {
					gallery: { id: 'numbering' },
				}),
			),
			strip(
				control('home.paragraph.decreaseIndent', 'pptx.text.decreaseIndent', 'Decrease Indent'),
				control('home.paragraph.increaseIndent', 'pptx.text.increaseIndent', 'Increase Indent'),
			),
			strip(
				control('home.paragraph.alignLeft', 'pptx.ribbon.alignLeft', 'Align Left'),
				control('home.paragraph.alignCenter', 'pptx.ribbon.alignCenter', 'Center'),
				control('home.paragraph.alignRight', 'pptx.ribbon.alignRight', 'Align Right'),
				control('home.paragraph.justify', 'pptx.ribbon.justify', 'Justify'),
			),
			pills(
				undefined,
				control(
					'home.paragraph.lineSpacing',
					'pptx.paragraph.lineSpacing',
					'Line Spacing',
					undefined,
					{ kind: 'select', select: { icon: true }, items: HOME_LINE_SPACING_ITEMS },
				),
				control(
					'home.paragraph.textDirection',
					'pptx.paragraph.textDirection',
					'Text Direction',
					undefined,
					{ kind: 'select', select: { icon: true }, items: HOME_TEXT_DIRECTION_ITEMS },
				),
				control('home.paragraph.columns', 'pptx.paragraph.columns', 'Columns', undefined, {
					kind: 'select',
					select: { icon: true },
					items: HOME_COLUMN_ITEMS,
				}),
			),
		],
	},
	editing: {
		clusters: [
			column(
				control('home.editing.find', 'pptx.editing.find', 'Find', undefined, {
					text: text('pptx.editing.find', 'Find'),
				}),
				control('home.editing.replace', 'pptx.ribbon.replace', 'Replace', undefined, {
					text: text('pptx.ribbon.replace', 'Replace'),
				}),
			),
			pills(
				undefined,
				control('home.editing.select', 'pptx.ribbon.tool.select', 'Select', undefined, {
					text: text('pptx.ribbon.tool.select', 'Select'),
					kind: 'menu',
					popup: true,
					items: HOME_SELECT_ITEMS,
				}),
			),
		],
	},
	...RIBBON_HOME_OBJECT_FAMILIES,
};
