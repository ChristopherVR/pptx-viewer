import { LUCIDE_ICON_NODES } from './lucide-icons';
import type { LucideNode } from './lucide-icons';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type LucideIconName = keyof typeof LUCIDE_ICON_NODES;

/**
 * A Lucide icon as an inline SVG, drawn from the trusted geometry table. The
 * viewer bindings draw the same glyphs through their own Lucide packages, so the
 * shared controls look identical to the rest of each chrome.
 */
export function createLucideIcon(doc: Document, name: LucideIconName): SVGSVGElement {
	const svg = doc.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	for (const [tag, attrs] of LUCIDE_ICON_NODES[name] as readonly LucideNode[]) {
		const node = doc.createElementNS(SVG_NS, tag);
		for (const [key, value] of Object.entries(attrs)) {
			node.setAttribute(key, value);
		}
		svg.append(node);
	}
	return svg;
}
