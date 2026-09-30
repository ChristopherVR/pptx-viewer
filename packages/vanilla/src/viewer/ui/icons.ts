/**
 * Minimal inline SVG icons for the toolbar (16x16 stroke icons, Lucide-style
 * paths). Kept as static path data + a tiny builder so no icon library is
 * pulled into the zero-dependency bundle.
 */
import { createRibbonControlIcon } from 'pptx-viewer-shared';

import { ICON_PATHS } from './icon-paths';
import type { IconName } from './icon-paths';

export type { IconName } from './icon-paths';

const RIBBON_ICONS: Partial<Record<IconName, string>> = {
	plus: 'home.slides.newSlide',
	'chevron-down': 'home.arrange.align.bottom',
	'slide-templates': 'home.slides.slideTemplates',
	layout: 'home.slides.layout',
	'folder-plus': 'home.slides.section',
	palette: 'home.drawing.quickStyles',
	layers: 'home.drawing.arrange',
	sparkles: 'home.drawing.shapeEffects',
	paste: 'home.clipboard.paste',
	cut: 'home.clipboard.cut',
	copy: 'home.clipboard.copy',
	bold: 'home.font.bold',
	italic: 'home.font.italic',
	underline: 'home.font.underline',
	strikethrough: 'home.font.strikethrough',
	'text-shadow': 'home.font.shadow',
	'a-up': 'home.font.increaseFontSize',
	'a-down': 'home.font.decreaseFontSize',
	'clear-format': 'home.font.clearFormatting',
	'change-case': 'home.font.changeCase',
	'char-spacing': 'home.font.characterSpacing',
	'font-color': 'home.font.fontColor',
	highlight: 'home.font.highlightColor',
	'bullet-list': 'home.paragraph.bullets',
	'numbered-list': 'home.paragraph.numbering',
	'indent-decrease': 'home.paragraph.decreaseIndent',
	'indent-increase': 'home.paragraph.increaseIndent',
	'align-left': 'home.paragraph.alignLeft',
	'align-center': 'home.paragraph.alignCenter',
	'align-right': 'home.paragraph.alignRight',
	'align-justify': 'home.paragraph.justify',
	'line-spacing': 'home.paragraph.lineSpacing',
	columns: 'home.paragraph.columns',
	'text-direction': 'home.paragraph.textDirection',
	search: 'home.editing.find',
	replace: 'home.editing.replace',
	cursor: 'home.editing.select',
	shapes: 'home.drawing.shapes',
	square: 'home.drawing.shapeFill',
	pen: 'home.drawing.shapeOutline',
	group: 'home.arrange.group',
	ungroup: 'home.arrange.ungroup',
	'send-backward': 'home.arrange.sendBackward',
	'bring-forward': 'home.arrange.bringForward',
	duplicate: 'home.arrange.duplicate',
	trash: 'home.arrange.delete',
	paintbrush: 'home.clipboard.formatPainter',
	'align-top': 'home.arrange.align.top',
	'align-middle': 'home.arrange.align.middle',
	'align-bottom': 'home.arrange.align.bottom',
	'distribute-h': 'home.arrange.distribute.horizontal',
	'distribute-v': 'home.arrange.distribute.vertical',
	crop: 'home.arrange.crop',
	'merge-shapes': 'home.arrange.mergeShapes',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Build a 16x16 stroked icon `<svg>` for the given name. */
export function createIcon(doc: Document, name: IconName): SVGSVGElement {
	const canonical = RIBBON_ICONS[name];
	if (canonical) {
		const svg = createRibbonControlIcon(doc, canonical);
		svg.setAttribute('aria-hidden', 'true');
		return svg;
	}
	const svg = doc.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	svg.setAttribute('aria-hidden', 'true');
	for (const d of ICON_PATHS[name]) {
		const path = doc.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', d);
		svg.appendChild(path);
	}
	return svg;
}
