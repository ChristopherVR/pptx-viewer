import {
	ClipboardList,
	File as FileIcon,
	LayoutGrid,
	Paintbrush,
	Plus,
	Presentation,
	Settings,
	Shapes,
	Sparkles,
	TextCursorInput,
	Type,
	Wand,
} from 'lucide-vue-next';
import type { Component } from 'vue';

import type { ToolbarSection } from './ribbon-types';

/** Sections surfaced as chips in `MobileMenuSheet`, in the same order as React's MENU_ITEMS. */
export type MobileMenuKey = Exclude<ToolbarSection, 'help'>;

export interface MobileMenuItemDef {
	key: MobileMenuKey;
	labelKey: string;
	icon: Component;
}

/**
 * Raw chip data (key, i18n key, icon). Extracted from `MobileMenuSheet.vue`
 * to keep that file under the repo's ~300 LOC convention; the caller resolves
 * `labelKey` with `t()`.
 */
export const MOBILE_MENU_ITEMS: MobileMenuItemDef[] = [
	{ key: 'home', labelKey: 'pptx.ribbon.home', icon: ClipboardList },
	{ key: 'insert', labelKey: 'pptx.ribbon.insert', icon: Plus },
	{ key: 'text', labelKey: 'pptx.ribbon.text', icon: Type },
	{ key: 'draw', labelKey: 'pptx.ribbon.draw', icon: Paintbrush },
	{ key: 'arrange', labelKey: 'pptx.ribbon.arrange', icon: Shapes },
	{ key: 'design', labelKey: 'pptx.ribbon.design', icon: LayoutGrid },
	{ key: 'transitions', labelKey: 'pptx.ribbon.transitions', icon: Sparkles },
	{ key: 'animations', labelKey: 'pptx.ribbon.animations', icon: Wand },
	{ key: 'slideShow', labelKey: 'pptx.ribbon.slideShow', icon: Presentation },
	{ key: 'review', labelKey: 'pptx.ribbon.review', icon: TextCursorInput },
	{ key: 'view', labelKey: 'pptx.ribbon.view', icon: Settings },
	{ key: 'file', labelKey: 'pptx.ribbon.file', icon: FileIcon },
];
