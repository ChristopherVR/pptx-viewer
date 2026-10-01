import React from 'react';
import {
	LuAlignCenter,
	LuAlignHorizontalSpaceAround,
	LuAlignLeft,
	LuAlignRight,
	LuAlignVerticalSpaceAround,
	LuCheck,
	LuChevronDown,
	LuChevronUp,
	LuClock,
	LuCopy,
	LuDatabase,
	LuDownload,
	LuFileText,
	LuImage,
	LuInfo,
	LuLock,
	LuPlay,
	LuPrinter,
	LuSearch,
	LuShieldAlert,
	LuType,
	LuVideo,
} from 'react-icons/lu';

import type { ViewerMode } from '../../types';

/* Style tokens: touch-friendly variants use min-h/min-w of 44px (WCAG 2.5.8)
 * via the `touch:` variant which maps to `@media (pointer: coarse)`.
 * Since Tailwind CSS 4 doesn't include a built-in `touch:` variant, we use
 * responsive `max-md:` prefixes as a proxy (mobile viewports are touch). */
export const _b =
	'inline-flex items-center justify-center px-2.5 py-1.5 max-md:min-h-[44px] max-md:min-w-[44px] active:scale-95 active:opacity-80';
export const gB = `${_b} border-r border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed`;
export const gL = `${_b} hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed`;
export const grp = 'inline-flex items-center rounded bg-muted text-xs overflow-hidden';
export const pill =
	'inline-flex items-center gap-1.5 px-2.5 py-1.5 max-md:min-h-[44px] rounded bg-muted hover:bg-accent text-xs transition-colors active:scale-95 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed';
export const sep = <div className='w-px self-stretch bg-border/40 mx-1 max-md:hidden' />;
export const ic = 'w-4 h-4';
export const ics = 'w-3.5 h-3.5';

/* Data-driven button groups */
export const MODES: ViewerMode[] = ['edit', 'preview', 'present'];

export const ALIGN_BTNS = [
	{ k: 'left', el: <LuAlignLeft className={ic} /> },
	{ k: 'center', el: <LuAlignCenter className={ic} /> },
	{ k: 'right', el: <LuAlignRight className={ic} /> },
	{ k: 'top', el: <LuChevronUp className={ic} /> },
	{ k: 'middle', el: <LuAlignCenter className={`${ic} rotate-90`} /> },
	{ k: 'bottom', el: <LuChevronDown className={ic} /> },
];

export const DISTRIBUTE_BTNS = [
	{ k: 'horizontal', el: <LuAlignHorizontalSpaceAround className={ic} /> },
	{ k: 'vertical', el: <LuAlignVerticalSpaceAround className={ic} /> },
];

export const OV: Array<{ labelKey: string; i: React.ReactNode; k: string }> = [
	{
		k: 'png',
		labelKey: 'pptx.ribbon.exportPng',
		i: <LuDownload className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'pdf',
		labelKey: 'pptx.ribbon.exportPdf',
		i: <LuFileText className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'video',
		labelKey: 'pptx.ribbon.exportVideo',
		i: <LuVideo className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'gif',
		labelKey: 'pptx.ribbon.exportGif',
		i: <LuImage className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'pptx',
		labelKey: 'pptx.file.saveAsPptxTooltip',
		i: <LuDownload className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'ppsx',
		labelKey: 'pptx.file.saveAsPpsxTooltip',
		i: <LuPlay className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'pptm',
		labelKey: 'pptx.file.saveAsPptmTooltip',
		i: <LuDatabase className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'ppt',
		labelKey: 'pptx.file.saveAsPptTooltip',
		i: <LuFileText className={`${ics} text-muted-foreground`} />,
	},
	{ k: '---0', labelKey: '', i: null },
	{
		k: 'print',
		labelKey: 'pptx.print.printButton',
		i: <LuPrinter className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'copyImg',
		labelKey: 'pptx.file.copyImageTooltip',
		i: <LuCopy className={`${ics} text-muted-foreground`} />,
	},
	{ k: '---', labelKey: '', i: null },
	{
		k: 'a11y',
		labelKey: 'pptx.ribbon.accessibilityCheck',
		i: <LuCheck className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'shortcuts',
		labelKey: 'pptx.settings.keyboardShortcuts',
		i: <LuSearch className={`${ics} text-muted-foreground`} />,
	},
	{ k: '---2', labelKey: '', i: null },
	{
		k: 'versionHistory',
		labelKey: 'pptx.ribbon.versionHistory',
		i: <LuClock className={`${ics} text-muted-foreground`} />,
	},
	{ k: '---3', labelKey: '', i: null },
	{
		k: 'documentProperties',
		labelKey: 'pptx.ribbon.documentProperties',
		i: <LuInfo className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'passwordProtection',
		labelKey: 'pptx.security.protectPresentation',
		i: <LuLock className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'fontEmbedding',
		labelKey: 'pptx.ribbon.embedFonts',
		i: <LuType className={`${ics} text-muted-foreground`} />,
	},
	{
		k: 'digitalSignatures',
		labelKey: 'pptx.viewer.digitalSignatures',
		i: <LuShieldAlert className={`${ics} text-muted-foreground`} />,
	},
];
