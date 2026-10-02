import { createLucideIcon } from './lucide-icon';
import type { LucideIconName } from './lucide-icon';

/** Which Lucide glyph each phone-bar slot draws (the same ones the bindings used). */
export const MOBILE_ICON_NAMES = {
	menu: 'menu',
	undo: 'undo',
	redo: 'redo',
	ai: 'sparkles',
	save: 'download',
	present: 'presentation',
	share: 'share-2',
	slides: 'layers',
	insert: 'plus',
	inspector: 'settings-2',
	comments: 'message-square',
	notes: 'sticky-note',
} as const satisfies Record<string, LucideIconName>;

export type MobileIcon = keyof typeof MOBILE_ICON_NAMES;

export function createMobileIcon(doc: Document, icon: MobileIcon): SVGSVGElement {
	return createLucideIcon(doc, MOBILE_ICON_NAMES[icon]);
}
