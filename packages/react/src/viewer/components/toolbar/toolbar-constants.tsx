import React from "react";
import {
  LuAlignCenter,
  LuAlignJustify,
  LuAlignLeft,
  LuAlignRight,
  LuBold,
  LuCheck,
  LuChevronDown,
  LuChevronUp,
  LuClock,
  LuCopy,
  LuDatabase,
  LuDownload,
  LuFileText,
  LuFolderOpen,
  LuImage,
  LuInfo,
  LuItalic,
  LuLock,
  LuMinus,
  LuMoveRight,
  LuPencil,
  LuPlay,
  LuPrinter,
  LuSearch,
  LuShieldAlert,
  LuSpline,
  LuStrikethrough,
  LuType,
  LuUnderline,
  LuVideo,
} from "react-icons/lu";
import type { DrawingTool, ViewerMode } from "../../types";

/* Style tokens — touch-friendly variants use min-h/min-w of 44px (WCAG 2.5.8)
 * via the `touch:` variant which maps to `@media (pointer: coarse)`.
 * Since Tailwind CSS 4 doesn't include a built-in `touch:` variant, we use
 * responsive `max-md:` prefixes as a proxy (mobile viewports are touch). */
export const _b = "inline-flex items-center justify-center px-2.5 py-1.5 max-md:min-h-[44px] max-md:min-w-[44px]";
export const gB = `${_b} border-r border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed`;
export const gL = `${_b} hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed`;
export const grp =
  "inline-flex items-center rounded bg-muted text-xs overflow-hidden";
export const pill =
  "inline-flex items-center gap-1.5 px-2.5 py-1.5 max-md:min-h-[44px] rounded bg-muted hover:bg-accent text-xs transition-colors";
export const sep = <div className="w-px h-5 bg-border/60 mx-0.5 max-md:hidden" />;
export const ic = "w-4 h-4";
export const ics = "w-3.5 h-3.5";

/* Data-driven button groups */
export const MODES: ViewerMode[] = ["edit", "preview", "present"];

export const ALIGN_BTNS = [
  { k: "left", el: <LuAlignLeft className={ic} /> },
  { k: "center", el: <LuAlignCenter className={ic} /> },
  { k: "right", el: <LuAlignRight className={ic} /> },
  { k: "top", el: <LuChevronUp className={ic} /> },
  { k: "middle", el: <LuAlignCenter className={`${ic} rotate-90`} /> },
  { k: "bottom", el: <LuChevronDown className={ic} /> },
];

export const DRAW_TOOLS: Array<{
  id: DrawingTool;
  icon: React.ReactNode;
  t: string;
  ac?: string;
}> = [
  { id: "select", icon: <LuMoveRight className={ic} />, t: "Select" },
  { id: "pen", icon: <LuPencil className={ic} />, t: "Pen" },
  {
    id: "highlighter",
    icon: <LuType className={ic} />,
    t: "Highlighter",
    ac: "bg-yellow-600 text-white",
  },
  { id: "eraser", icon: <LuMinus className={ic} />, t: "Eraser" },
  { id: "freeform", icon: <LuSpline className={ic} />, t: "Freeform" },
];

export const OV: Array<{ l: string; i: React.ReactNode; k: string }> = [
  {
    k: "png",
    l: "Export as PNG",
    i: <LuDownload className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "pdf",
    l: "Export as PDF",
    i: <LuFileText className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "video",
    l: "Export as Video",
    i: <LuVideo className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "gif",
    l: "Export as GIF",
    i: <LuImage className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "package",
    l: "Package for Sharing",
    i: <LuFolderOpen className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "ppsx",
    l: "Save as Slide Show (.ppsx)",
    i: <LuPlay className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "pptm",
    l: "Save as Macro-Enabled (.pptm)",
    i: <LuDatabase className={`${ics} text-muted-foreground`} />,
  },
  { k: "---0", l: "", i: null },
  {
    k: "print",
    l: "Print",
    i: <LuPrinter className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "copyImg",
    l: "Copy Slide as Image",
    i: <LuCopy className={`${ics} text-muted-foreground`} />,
  },
  { k: "---", l: "", i: null },
  {
    k: "a11y",
    l: "Accessibility Check",
    i: <LuCheck className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "shortcuts",
    l: "Keyboard Shortcuts",
    i: <LuSearch className={`${ics} text-muted-foreground`} />,
  },
  { k: "---2", l: "", i: null },
  {
    k: "versionHistory",
    l: "Version History",
    i: <LuClock className={`${ics} text-muted-foreground`} />,
  },
  { k: "---3", l: "", i: null },
  {
    k: "documentProperties",
    l: "Document Properties\u2026",
    i: <LuInfo className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "passwordProtection",
    l: "Protect Presentation",
    i: <LuLock className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "fontEmbedding",
    l: "Embed Fonts",
    i: <LuType className={`${ics} text-muted-foreground`} />,
  },
  {
    k: "digitalSignatures",
    l: "Digital Signatures\u2026",
    i: <LuShieldAlert className={`${ics} text-muted-foreground`} />,
  },
];

export const FMT = [
  { i: <LuBold className={ic} />, t: "Bold" },
  { i: <LuItalic className={ic} />, t: "Italic" },
  { i: <LuUnderline className={ic} />, t: "Underline" },
  { i: <LuStrikethrough className={ic} />, t: "Strikethrough" },
];

export const ATXT = [
  { i: <LuAlignLeft className={ic} />, t: "Align left" },
  { i: <LuAlignCenter className={ic} />, t: "Align center" },
  { i: <LuAlignRight className={ic} />, t: "Align right" },
  { i: <LuAlignJustify className={ic} />, t: "Justify" },
];
