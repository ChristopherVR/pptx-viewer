import {
	AlignCenter,
	AlignHorizontalSpaceAround,
	AlignJustify,
	AlignLeft,
	AlignRight,
	AlignVerticalSpaceAround,
	Bold,
	Check,
	ChevronDown,
	ChevronUp,
	Clock,
	Copy,
	Database,
	Download,
	FileText,
	FolderOpen,
	Image,
	Info,
	Italic,
	Lock,
	Minus,
	MoveRight,
	Pencil,
	Play,
	Printer,
	Search,
	ShieldAlert,
	Spline,
	Strikethrough,
	Type,
	Underline,
	Video,
} from 'lucide-vue-next';
/**
 * Shared style tokens + data tables for the Office-style ribbon: the Vue port
 * of React's `toolbar/toolbar-constants.tsx`. Class strings are copied verbatim
 * so the Vue ribbon renders pixel-for-pixel with React's Tailwind chrome; the
 * JSX icon arrays become arrays of `lucide-vue-next` component references
 * (rendered via `<component :is="…" />`) since `react-icons/lu` ≅ Lucide.
 */
import type { Component } from 'vue';

import type { DrawingTool, ToolbarSection, ViewerMode } from './ribbon-types';

/* Style tokens: touch-friendly variants use min-h/min-w of 44px (WCAG 2.5.8).
 * Tailwind 4 has no built-in `touch:` variant, so `max-md:` is used as a proxy
 * (mobile viewports are touch). Copied verbatim from React for visual parity. */
export const BTN_BASE =
	'inline-flex items-center justify-center px-2.5 py-1.5 max-md:min-h-[44px] max-md:min-w-[44px] active:scale-95 active:opacity-80';
/** Grouped button with a right divider (inside a `grp` cluster). */
export const gB = `${BTN_BASE} border-r border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed`;
/** Grouped button, no divider (last in a `grp` cluster). */
export const gL = `${BTN_BASE} hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed`;
/** Rounded button cluster container. */
export const grp = 'inline-flex items-center rounded bg-muted text-xs overflow-hidden';
/** Standalone rounded pill button. */
export const pill =
	'inline-flex items-center gap-1.5 px-2.5 py-1.5 max-md:min-h-[44px] rounded bg-muted hover:bg-accent text-xs transition-colors active:scale-95 active:opacity-80';
/** Vertical separator between ribbon groups (render as `<div :class="SEP" />`). */
export const SEP = 'w-px self-stretch bg-border/40 mx-1 max-md:hidden';
/** Caption label under a ribbon group ("Clipboard", "Font", …). */
export const GROUP_LABEL = 'text-[9px] text-muted-foreground leading-none';
/** Popover-menu panel shell (dropdowns). */
export const MENU_PANEL =
	'rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 max-h-60 overflow-y-auto';
/** Popover-menu item. */
export const MENU_ITEM =
	'flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors';
export const ic = 'w-4 h-4';
export const ics = 'w-3.5 h-3.5';

/* Data-driven button groups (icon component refs, not JSX). */
export const MODES: ViewerMode[] = ['edit', 'preview', 'present'];

export const ALIGN_BTNS: Array<{ k: string; icon: Component; rotate?: boolean }> = [
	{ k: 'left', icon: AlignLeft },
	{ k: 'center', icon: AlignCenter },
	{ k: 'right', icon: AlignRight },
	{ k: 'top', icon: ChevronUp },
	{ k: 'middle', icon: AlignCenter, rotate: true },
	{ k: 'bottom', icon: ChevronDown },
];

export const DISTRIBUTE_BTNS: Array<{ k: string; icon: Component }> = [
	{ k: 'horizontal', icon: AlignHorizontalSpaceAround },
	{ k: 'vertical', icon: AlignVerticalSpaceAround },
];

export const DRAW_TOOLS: Array<{
	id: DrawingTool;
	icon: Component;
	labelKey: string;
	ac?: string;
}> = [
	{
		id: 'select',
		icon: MoveRight,
		labelKey: 'pptx.ribbon.tool.select',
		ac: 'bg-primary text-white',
	},
	{ id: 'pen', icon: Pencil, labelKey: 'pptx.ribbon.tool.pen', ac: 'bg-primary text-white' },
	{
		id: 'highlighter',
		icon: Type,
		labelKey: 'pptx.ribbon.tool.highlighter',
		ac: 'bg-yellow-600 text-white',
	},
	{ id: 'eraser', icon: Minus, labelKey: 'pptx.ribbon.tool.eraser', ac: 'bg-red-600 text-white' },
	{
		id: 'freeform',
		icon: Spline,
		labelKey: 'pptx.ribbon.tool.freeform',
		ac: 'bg-primary text-white',
	},
];

/** Overflow / File menu entries (`---*` keys render as separators). */
export const OV: Array<{ labelKey: string; icon: Component | null; k: string }> = [
	{ k: 'png', labelKey: 'pptx.ribbon.exportPng', icon: Download },
	{ k: 'pdf', labelKey: 'pptx.ribbon.exportPdf', icon: FileText },
	{ k: 'video', labelKey: 'pptx.ribbon.exportVideo', icon: Video },
	{ k: 'gif', labelKey: 'pptx.ribbon.exportGif', icon: Image },
	{ k: 'package', labelKey: 'pptx.file.packageTooltip', icon: FolderOpen },
	{ k: 'pptx', labelKey: 'pptx.file.saveAsPptxTooltip', icon: Download },
	{ k: 'ppsx', labelKey: 'pptx.file.saveAsPpsxTooltip', icon: Play },
	{ k: 'pptm', labelKey: 'pptx.file.saveAsPptmTooltip', icon: Database },
	{ k: '---0', labelKey: '', icon: null },
	{ k: 'print', labelKey: 'pptx.print.printButton', icon: Printer },
	{ k: 'copyImg', labelKey: 'pptx.file.copyImageTooltip', icon: Copy },
	{ k: '---', labelKey: '', icon: null },
	{ k: 'a11y', labelKey: 'pptx.ribbon.accessibilityCheck', icon: Check },
	{ k: 'shortcuts', labelKey: 'pptx.settings.keyboardShortcuts', icon: Search },
	{ k: '---2', labelKey: '', icon: null },
	{ k: 'versionHistory', labelKey: 'pptx.ribbon.versionHistory', icon: Clock },
	{ k: '---3', labelKey: '', icon: null },
	{ k: 'documentProperties', labelKey: 'pptx.ribbon.documentProperties', icon: Info },
	{ k: 'passwordProtection', labelKey: 'pptx.security.protectPresentation', icon: Lock },
	{ k: 'fontEmbedding', labelKey: 'pptx.ribbon.embedFonts', icon: Type },
	{ k: 'digitalSignatures', labelKey: 'pptx.viewer.digitalSignatures', icon: ShieldAlert },
];

/** Character formatting toggles (Bold/Italic/Underline/Strikethrough). */
export const FMT: Array<{ id: string; icon: Component; labelKey: string }> = [
	{ id: 'bold', icon: Bold, labelKey: 'pptx.textPanel.bold' },
	{ id: 'italic', icon: Italic, labelKey: 'pptx.textPanel.italic' },
	{ id: 'underline', icon: Underline, labelKey: 'pptx.textPanel.underline' },
	{ id: 'strikethrough', icon: Strikethrough, labelKey: 'pptx.textPanel.strikethrough' },
];

/** Paragraph alignment toggles. */
export const ATXT: Array<{ id: string; icon: Component; labelKey: string }> = [
	{ id: 'left', icon: AlignLeft, labelKey: 'pptx.ribbon.alignLeft' },
	{ id: 'center', icon: AlignCenter, labelKey: 'pptx.ribbon.alignCenter' },
	{ id: 'right', icon: AlignRight, labelKey: 'pptx.ribbon.alignRight' },
	{ id: 'justify', icon: AlignJustify, labelKey: 'pptx.ribbon.justify' },
];

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

export const COMMON_FONTS = [
	'Arial',
	'Calibri',
	'Cambria',
	'Comic Sans MS',
	'Courier New',
	'Georgia',
	'Helvetica',
	'Impact',
	'Segoe UI',
	'Tahoma',
	'Times New Roman',
	'Trebuchet MS',
	'Verdana',
];

export const COMMON_SIZES = [
	8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 96,
];
