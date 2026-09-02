import type { PptxElement, PptxSlide, TextStyle } from 'pptx-viewer-core';
import type { PlaceholderPromptMode } from 'pptx-viewer-shared';
import type React from 'react';

import type { TableCellEditorState } from '../../types';
import type { ElementAnimationState } from '../../utils/animation-timeline';
import type { TableStyleContext } from '../../utils/table-parse';
import type { FieldSubstitutionContext } from '../../utils/text-field-substitution';
import type { ElementFindHighlights } from '../../utils/text-segment-helpers';

/**
 * Options bag for {@link renderBody}. Replaces what used to be a 39-argument
 * positional signature; the positional form silently dropped the trailing
 * SmartArt-editing callbacks at the call site (they were never passed), which
 * left inline SmartArt node editing dead. A named object makes every field
 * required-by-name and immune to that class of wiring bug.
 */
export interface RenderBodyOptions {
	el: PptxElement;
	isImg: boolean;
	isEditing: boolean;
	editText: string;
	spellCheck: boolean;
	txtSE: TextStyle | undefined;
	txtS: React.CSSProperties;
	vecShape: React.ReactNode;
	imgStyle: React.CSSProperties;
	imgFilter: string | undefined;
	imgOpacity: number | undefined;
	imgAlt: string;
	isTxtEl: boolean;
	media: Map<string, string>;
	tableSt: TableCellEditorState | null | undefined;
	isSel: boolean;
	doInk: boolean;
	doGrp: boolean;
	/** Optional rich read-only dispatcher for children inside a grouped element. */
	renderGroupChild?: (child: PptxElement, index: number) => React.ReactNode;
	onEditChange: (t: string) => void;
	onCommit: () => void;
	onCancel: () => void;
	onCellSel?: (c: TableCellEditorState | null) => void;
	onCellCommit?: (rowIndex: number, colIndex: number, text: string) => void;
	onColResize?: (newWidths: number[]) => void;
	onRowResize?: (rowIndex: number, newHeight: number) => void;
	findHl?: ElementFindHighlights;
	onHyperlinkClick?: (url: string) => void;
	isPresentationPassive?: boolean;
	/**
	 * True when this body is painted onto a STILL of a slide (the presenter
	 * console's panes, a thumbnail, any `StaticElementRenderer` surface) rather
	 * than onto the canvas or the live show stage. Media reads it: a still never
	 * carries the browser's native transport, and `isPresentationPassive` cannot
	 * answer that on its own, because a still is not in presentation mode.
	 */
	isStaticSurface?: boolean;
	/**
	 * The surface this body is painted on, for the shared
	 * `placeholderPromptDescriptor` rule: an empty inherited placeholder's
	 * "Click to add title" hint renders on the editing canvas (`'edit'`) only.
	 * Defaults to `'present'`, so a caller that says nothing never leaks the
	 * authoring hint onto an audience screen or a still.
	 */
	placeholderPromptMode?: PlaceholderPromptMode;
	handleMediaPlayStateChange?: (isPlaying: boolean) => void;
	presentationElementStates?: ReadonlyMap<string, ElementAnimationState>;
	/** All elements on the current slide, used for linked text box overflow distribution. */
	slideElements?: readonly PptxElement[];
	/** All slides in the presentation, used for zoom element thumbnails. */
	allSlides?: readonly PptxSlide[];
	/** Callback fired when a zoom element is clicked in presentation mode. */
	onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void;
	/** Index of the slide that contains the current element (for zoom return navigation). */
	sourceSlideIndex?: number;
	/** Context for text field placeholder substitution (slide number, header/footer, etc.). */
	fieldContext?: FieldSubstitutionContext;
	/** Theme + table style map for resolving table band/header colours. */
	tableStyleContext?: TableStyleContext;
	/** Callback for inline formatting (Ctrl+B/I/U while editing). */
	onFormatText?: (updates: Partial<TextStyle>) => void;
	/** Whether inline SmartArt node editing is permitted for this element. */
	canEditSmartArt?: boolean;
	/** Commit a SmartArt node text edit (scoped to this element). */
	onUpdateSmartArtElement?: (updates: Partial<PptxElement>) => void;
	/** Whether direct on-canvas chart editing is permitted for this element. */
	canEditChart?: boolean;
	/** Commit an on-canvas chart edit (scoped to this element). */
	onUpdateChartElement?: (updates: Partial<PptxElement>) => void;
}
