import {
	AlignCenter,
	AlignHorizontalSpaceAround,
	AlignLeft,
	AlignRight,
	AlignVerticalSpaceAround,
	Check,
	ChevronDown,
	ChevronUp,
	Clock,
	Copy,
	Database,
	Download,
	FileText,
	Image,
	Info,
	Lock,
	Play,
	Printer,
	Search,
	ShieldAlert,
	Type,
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

import type { ViewerMode } from './ribbon-types';

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

/** Overflow / File menu entries (`---*` keys render as separators). */
export const OV: Array<{ labelKey: string; icon: Component | null; k: string }> = [
	{ k: 'png', labelKey: 'pptx.ribbon.exportPng', icon: Download },
	{ k: 'pdf', labelKey: 'pptx.ribbon.exportPdf', icon: FileText },
	{ k: 'video', labelKey: 'pptx.ribbon.exportVideo', icon: Video },
	{ k: 'gif', labelKey: 'pptx.ribbon.exportGif', icon: Image },
	{ k: 'pptx', labelKey: 'pptx.file.saveAsPptxTooltip', icon: Download },
	{ k: 'ppsx', labelKey: 'pptx.file.saveAsPpsxTooltip', icon: Play },
	{ k: 'pptm', labelKey: 'pptx.file.saveAsPptmTooltip', icon: Database },
	{ k: 'ppt', labelKey: 'pptx.file.saveAsPptTooltip', icon: FileText },
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

/**
 * Re-exported from `pptx-viewer-shared` rather than declared here.
 *
 * This binding kept its own copy of the family list, which is exactly how the
 * five bindings end up offering different fonts. The grouped Home-tab dropdown
 * now builds itself from `buildFontCatalog`, so nothing in this package should
 * need the flat list at all; the alias remains only for external importers.
 */
export { COMMON_FONT_FAMILIES as COMMON_FONTS } from 'pptx-viewer-shared';

export const COMMON_SIZES = [
	8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 96,
];
