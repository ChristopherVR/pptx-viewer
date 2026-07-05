/**
 * Toolbar section definitions and keyboard shortcut reference items.
 */

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

export const SHORTCUT_REFERENCE_ITEMS: ShortcutReferenceItem[] = [
	{ actionKey: 'pptx.toolbar.undo', shortcut: 'Ctrl/Cmd+Z' },
	{ actionKey: 'pptx.toolbar.redo', shortcut: 'Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y' },
	{ actionKey: 'pptx.shortcuts.action.copyElement', shortcut: 'Ctrl/Cmd+C' },
	{ actionKey: 'pptx.shortcuts.action.cutElement', shortcut: 'Ctrl/Cmd+X' },
	{ actionKey: 'pptx.shortcuts.action.pasteElement', shortcut: 'Ctrl/Cmd+V' },
	{ actionKey: 'pptx.shortcuts.action.duplicateElement', shortcut: 'Ctrl/Cmd+D' },
	{ actionKey: 'pptx.shortcuts.action.deleteElement', shortcut: 'Delete / Backspace' },
	{ actionKey: 'pptx.shortcuts.action.nudgeElement', shortcut: 'Arrow keys' },
	{ actionKey: 'pptx.shortcuts.action.nudgeElementLarge', shortcut: 'Shift+Arrow keys' },
	{ actionKey: 'pptx.shortcuts.action.zoomCanvas', shortcut: 'Ctrl/Cmd+Mouse wheel' },
	{ actionKey: 'pptx.shortcuts.action.commitTextEdit', shortcut: 'Ctrl/Cmd+Enter' },
	{ actionKey: 'pptx.shortcuts.action.cancelTextEdit', shortcut: 'Escape' },
];
