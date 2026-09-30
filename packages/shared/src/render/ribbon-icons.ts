import { ARRANGE_ALIGNMENT_ICONS } from './ribbon-icons/arrange-alignment-icons';
import { ARRANGE_OPERATIONS_ICONS } from './ribbon-icons/arrange-operations-icons';
import { CLIPBOARD_ICONS } from './ribbon-icons/clipboard-icons';
import { DRAWING_ICONS } from './ribbon-icons/drawing-icons';
import { EDITING_ICONS } from './ribbon-icons/editing-icons';
import { FONT_ICONS } from './ribbon-icons/font-icons';
import { PARAGRAPH_ICONS } from './ribbon-icons/paragraph-icons';
import { SLIDES_ICONS } from './ribbon-icons/slides-icons';
import type { RibbonIconArtwork, RibbonIconNode } from './ribbon-icons/types';

export type { RibbonIconArtwork, RibbonIconNode } from './ribbon-icons/types';

/** Canonical Home ribbon artwork, matching the React reference. */
export const RIBBON_CONTROL_ICONS: Record<string, RibbonIconArtwork> = {
	...CLIPBOARD_ICONS,
	...SLIDES_ICONS,
	...FONT_ICONS,
	...PARAGRAPH_ICONS,
	...EDITING_ICONS,
	...DRAWING_ICONS,
	...ARRANGE_ALIGNMENT_ICONS,
	...ARRANGE_OPERATIONS_ICONS,
};

/** Thin DOM renderer for Vanilla; reactive bindings render the same nodes. */
export function createRibbonControlIcon(doc: Document, name: string): SVGSVGElement {
	const artwork = RIBBON_CONTROL_ICONS[name];
	if (!artwork) {
		throw new Error(`Unknown ribbon icon: ${name}`);
	}
	const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
	for (const [key, value] of Object.entries(artwork.attrs)) {
		svg.setAttribute(key, value);
	}
	function append(parent: Element, nodes: readonly RibbonIconNode[]): void {
		for (const node of nodes) {
			const element = doc.createElementNS(svg.namespaceURI, node.tag);
			for (const [key, value] of Object.entries(node.attrs)) {
				element.setAttribute(key, value);
			}
			if (node.text) {
				element.textContent = node.text;
			}
			if (node.children) {
				append(element, node.children);
			}
			parent.append(element);
		}
	}
	append(svg, artwork.children);
	return svg;
}
