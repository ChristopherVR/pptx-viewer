/**
 * Toolbar section definitions and keyboard shortcut reference items.
 */

import { VIEWER_SHORTCUT_REFERENCE } from 'pptx-viewer-shared';

import type { ShortcutReferenceItem, ToolbarSection } from '../types';

export const TOOLBAR_SECTIONS: Array<{ id: ToolbarSection; labelKey: string }> = [
	{ id: 'file', labelKey: 'pptx.ribbon.tab.file' },
	{ id: 'home', labelKey: 'pptx.ribbon.tab.home' },
	{ id: 'insert', labelKey: 'pptx.ribbon.tab.insert' },
	{ id: 'draw', labelKey: 'pptx.ribbon.tab.draw' },
	{ id: 'design', labelKey: 'pptx.ribbon.tab.design' },
	{ id: 'transitions', labelKey: 'pptx.ribbon.tab.transitions' },
	{ id: 'animations', labelKey: 'pptx.ribbon.tab.animations' },
	{ id: 'slideShow', labelKey: 'pptx.ribbon.tab.slideShow' },
	{ id: 'record', labelKey: 'pptx.ribbon.tab.record' },
	{ id: 'review', labelKey: 'pptx.ribbon.tab.review' },
	{ id: 'view', labelKey: 'pptx.ribbon.tab.view' },
	{ id: 'help', labelKey: 'pptx.ribbon.tab.help' },
];

/**
 * The shortcut cheat sheet, straight from the shared reference so the panel can
 * never list a binding whose key the shared keymap does not actually resolve.
 */
export const SHORTCUT_REFERENCE_ITEMS: readonly ShortcutReferenceItem[] = VIEWER_SHORTCUT_REFERENCE;
