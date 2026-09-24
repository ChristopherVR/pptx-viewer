import type { TextStyle } from 'pptx-viewer-core';

/** Paragraph alignment set by Ctrl+L/E/R/J. */
export type EditorTextAlign = NonNullable<TextStyle['align']>;

/** Which way Ctrl+Shift+>/< and Ctrl+]/[ step the font-size ladder. */
export type FontSizeStepDirection = 'increase' | 'decrease';

/** Which way Tab/Shift+Tab cycles the slide's selection. */
export type SelectionCycleDirection = 'next' | 'prev';
