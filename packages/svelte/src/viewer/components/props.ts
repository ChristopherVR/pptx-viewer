import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize, RenderParagraph } from 'pptx-viewer-shared';

/**
 * Prop contracts for the internal viewer components. Kept in a plain `.ts`
 * module (not inside the SFCs) per repo convention: SFCs stay thin
 * presentation, logic and types live in lintable TypeScript files.
 */

/** Props shared by every element-level renderer. */
export interface ElementRendererProps {
	element: PptxElement;
	mediaDataUrls: Map<string, string>;
	zIndex: number;
}

export interface TextBlockProps {
	paragraphs: RenderParagraph[];
	/** Inline `style` string for the text block wrapper. */
	textStyle: string;
}

export interface SlideStageProps {
	slide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	scale?: number;
}

export interface ViewerToolbarProps {
	/** Active slide (0-based). */
	current: number;
	total: number;
	/** Currently-effective zoom percent (rounded). */
	zoomPercent: number;
	isFullscreen: boolean;
	onprev: () => void;
	onnext: () => void;
	onzoomin: () => void;
	onzoomout: () => void;
	onzoomfit: () => void;
	onfullscreen: () => void;
}

export interface ThumbnailRailProps {
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	current: number;
	onselect: (index: number) => void;
}
