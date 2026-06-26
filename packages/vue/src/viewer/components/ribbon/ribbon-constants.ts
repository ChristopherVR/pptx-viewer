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

export const DRAW_TOOLS: Array<{ id: DrawingTool; icon: Component; t: string; ac?: string }> = [
	{ id: 'select', icon: MoveRight, t: 'Select', ac: 'bg-primary text-white' },
	{ id: 'pen', icon: Pencil, t: 'Pen', ac: 'bg-primary text-white' },
	{ id: 'highlighter', icon: Type, t: 'Highlighter', ac: 'bg-yellow-600 text-white' },
	{ id: 'eraser', icon: Minus, t: 'Eraser', ac: 'bg-red-600 text-white' },
	{ id: 'freeform', icon: Spline, t: 'Freeform', ac: 'bg-primary text-white' },
];

/** Overflow / File menu entries (`---*` keys render as separators). */
export const OV: Array<{ l: string; icon: Component | null; k: string }> = [
	{ k: 'png', l: 'Export as PNG', icon: Download },
	{ k: 'pdf', l: 'Export as PDF', icon: FileText },
	{ k: 'video', l: 'Export as Video', icon: Video },
	{ k: 'gif', l: 'Export as GIF', icon: Image },
	{ k: 'package', l: 'Package for Sharing', icon: FolderOpen },
	{ k: 'pptx', l: 'Save as Presentation (.pptx)', icon: Download },
	{ k: 'ppsx', l: 'Save as Slide Show (.ppsx)', icon: Play },
	{ k: 'pptm', l: 'Save as Macro-Enabled (.pptm)', icon: Database },
	{ k: '---0', l: '', icon: null },
	{ k: 'print', l: 'Print', icon: Printer },
	{ k: 'copyImg', l: 'Copy Slide as Image', icon: Copy },
	{ k: '---', l: '', icon: null },
	{ k: 'a11y', l: 'Accessibility Check', icon: Check },
	{ k: 'shortcuts', l: 'Keyboard Shortcuts', icon: Search },
	{ k: '---2', l: '', icon: null },
	{ k: 'versionHistory', l: 'Version History', icon: Clock },
	{ k: '---3', l: '', icon: null },
	{ k: 'documentProperties', l: 'Document Properties…', icon: Info },
	{ k: 'passwordProtection', l: 'Protect Presentation', icon: Lock },
	{ k: 'fontEmbedding', l: 'Embed Fonts', icon: Type },
	{ k: 'digitalSignatures', l: 'Digital Signatures…', icon: ShieldAlert },
];

/** Character formatting toggles (Bold/Italic/Underline/Strikethrough). */
export const FMT: Array<{ icon: Component; t: string }> = [
	{ icon: Bold, t: 'Bold' },
	{ icon: Italic, t: 'Italic' },
	{ icon: Underline, t: 'Underline' },
	{ icon: Strikethrough, t: 'Strikethrough' },
];

/** Paragraph alignment toggles. */
export const ATXT: Array<{ icon: Component; t: string }> = [
	{ icon: AlignLeft, t: 'Align left' },
	{ icon: AlignCenter, t: 'Align center' },
	{ icon: AlignRight, t: 'Align right' },
	{ icon: AlignJustify, t: 'Justify' },
];

export const TOOLBAR_SECTIONS: Array<{ id: ToolbarSection; label: string }> = [
	{ id: 'file', label: 'File' },
	{ id: 'home', label: 'Home' },
	{ id: 'insert', label: 'Insert' },
	{ id: 'text', label: 'Text' },
	{ id: 'draw', label: 'Draw' },
	{ id: 'arrange', label: 'Arrange' },
	{ id: 'design', label: 'Design' },
	{ id: 'transitions', label: 'Transitions' },
	{ id: 'animations', label: 'Animations' },
	{ id: 'slideShow', label: 'Slide Show' },
	{ id: 'review', label: 'Review' },
	{ id: 'view', label: 'View' },
	{ id: 'help', label: 'Help' },
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
