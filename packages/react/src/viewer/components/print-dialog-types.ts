/**
 * Shared types, interfaces, and constants for the PrintDialog family.
 *
 * The print settings types/constants now live in `pptx-viewer-shared`
 * (`export/print-document` and `export/handout-layout`) and are re-exported
 * here. Only the React-specific `PrintDialogProps` interface and the
 * `radioClass` Tailwind helper stay local.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { PrintSettings } from 'pptx-viewer-shared';

export type {
	HandoutSlidesPerPage,
	PrintColorMode,
	PrintOrientation,
	PrintSettings,
	PrintSlideRange,
	PrintWhat,
} from 'pptx-viewer-shared';
export { HANDOUT_OPTIONS } from 'pptx-viewer-shared';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PrintDialogProps {
	open: boolean;
	onClose: () => void;
	onPrint: (settings: PrintSettings) => void;
	slides: PptxSlide[];
	activeSlideIndex: number;
	/** Default slides-per-page from presentation properties. */
	defaultSlidesPerPage?: number;
	/** Default frame-slides from presentation properties. */
	defaultFrameSlides?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a Tailwind class string for styled radio/checkbox cards. */
export const radioClass = (active: boolean): string =>
	`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
		active
			? 'border-primary bg-primary/10 text-foreground'
			: 'border-border bg-background text-muted-foreground hover:border-primary/40'
	}`;
