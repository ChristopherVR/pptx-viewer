import type { PptxHandler, PptxSlide, PptxTheme, TextSegment } from 'pptx-viewer-core';
import type { CanvasSize, RemoteCursor, RulerUnit, SanitizedPresence } from 'pptx-viewer-shared';
import type { AiChangeBatch } from 'pptx-viewer-shared/ai';

import type { Translator } from '../../i18n/translator';
import type { AiCanvasHighlight } from '../ai/ai-panel-controller.svelte';
import type { EditorController } from '../editor/editor-controller.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import type { TransitionState } from '../presentation';
import type { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';
import type { ChromeUiState } from '../state/chrome-ui.svelte';
import type { StageContextMenu } from './props';

/**
 * Prop contracts for the viewer body and the sub-views it composes
 * (`ViewerBody` -> `ViewerStage` -> `SlideOverlays`, plus `RulerStrips`).
 *
 * Kept in a plain `.ts` module, like `props.ts`, so the SFCs stay thin
 * presentation: a component that declares its own interfaces is the smell the
 * repo's file-size rule is aimed at. Splitting the body's contract out also
 * lets each sub-view state its slice as a `Pick<>` of one source of truth,
 * instead of three drifting copies of the same twenty props.
 */

/** A user-placed drawing guide: `h` is a horizontal line, `v` a vertical one. */
export interface ViewerGuide {
	axis: 'h' | 'v';
	position: number;
}

export interface ViewerBodyProps {
	t: Translator;
	editor: EditorState;
	handler?: PptxHandler | null;
	presentationTheme?: PptxTheme;
	onthemechange?: (theme: PptxTheme) => void;
	chromeVisible: boolean;
	showThumbnails: boolean;
	showNotes: boolean;
	displaySlides: PptxSlide[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	current: number;
	onselect: (index: number) => void;
	loading: boolean;
	isEncrypted: boolean;
	error: string | null;
	activeSlide: PptxSlide | undefined;
	scale: number;
	presenting: boolean;
	/** Active slide-transition overlay state (presentation mode), or null. */
	presentationTransition: TransitionState | null;
	/** Called when the transition overlay finishes (host drops the overlay). */
	onTransitionDone: () => void;
	/** Advance the presentation (step animation build, else next slide). */
	onAdvance: () => void;
	editingActive: boolean;
	controller: EditorController;
	onstageresize: (width: number, height: number) => void;
	onstageholder: (el: HTMLDivElement | null) => void;
	notesExpanded: boolean;
	onNotesCommit?: (notes: string, segments?: TextSegment[]) => void;
	onNotesToggle: () => void;
	/** Remote collaborators' cursors on the active slide (unscaled slide px). */
	collabCursors?: RemoteCursor[];
	/** Remote collaborators' presence (drives the remote-selection overlay). */
	collabPresences?: SanitizedPresence[];
	/** Open element menu position + hit table cell, from the editing controller. */
	contextMenu: StageContextMenu | null;
	onContextMenuClose: () => void;
	onmoveSlide?: (fromIndex: number, toIndex: number) => void;
	annotations: PresentationAnnotations;
	guides?: readonly ViewerGuide[];
	onchangeguide?: (index: number, position: number) => void;
	/** Drop a new guide dragged off a ruler strip (View > Rulers must be on). */
	onaddguide?: (axis: 'h' | 'v', position: number) => void;
	/** View > Rulers: paint the tick strips along the top/left of the stage. */
	showRulers?: boolean;
	/** Unit system for the ruler labels. Defaults to inches, as PowerPoint does. */
	rulerUnit?: RulerUnit;
	spellCheck?: boolean;
	/** Side-panel open/collapsed state shared with the ribbon's toggles. */
	chromeUi?: ChromeUiState;
	/** True while the AI panel is picking a slide element (see SlideCanvas). */
	aiPickMode?: boolean;
	/** True while a running AI tool is active (enables the canvas colour tween). */
	aiActive?: boolean;
	/** Rings the AI focus overlay should draw on the active slide. */
	aiHighlights?: readonly AiCanvasHighlight[];
	/** Just-applied AI change batch the canvas should animate (glide/fade/glow). */
	aiChangeBatch?: AiChangeBatch | null;
	/** Route a picked canvas element to the AI focus (pick mode). */
	onaipickelement?: (elementId: string) => void;
	/** "Ask AI about this" from the element context menu (gated on the `ai` prop). */
	onaskai?: () => void;
	/** "Fix with AI" from the element context menu (gated on the `ai` prop). */
	onfixai?: () => void;
}

/**
 * The slice of the body's contract that the stage area consumes: everything
 * about the slide surface itself, none of the surrounding chrome (thumbnail
 * rail, notes panel, inspector).
 */
export type ViewerStageProps = Pick<
	ViewerBodyProps,
	| 't'
	| 'editor'
	| 'controller'
	| 'canvasSize'
	| 'mediaDataUrls'
	| 'current'
	| 'loading'
	| 'isEncrypted'
	| 'error'
	| 'activeSlide'
	| 'scale'
	| 'presenting'
	| 'presentationTransition'
	| 'onTransitionDone'
	| 'onAdvance'
	| 'editingActive'
	| 'onstageholder'
	| 'collabCursors'
	| 'collabPresences'
	| 'contextMenu'
	| 'onContextMenuClose'
	| 'annotations'
	| 'guides'
	| 'onchangeguide'
	| 'onaddguide'
	| 'showRulers'
	| 'rulerUnit'
	| 'spellCheck'
	| 'chromeUi'
	| 'aiPickMode'
	| 'aiActive'
	| 'aiHighlights'
	| 'aiChangeBatch'
	| 'onaipickelement'
	| 'onaskai'
	| 'onfixai'
>;

/**
 * The overlay stack painted inside the scaled stage. Every member is authored
 * in unscaled slide coordinates, so they all take `scale`/`canvasSize` rather
 * than positioning themselves off the DOM.
 */
export type SlideOverlaysProps = Pick<
	ViewerStageProps,
	| 'editor'
	| 'controller'
	| 'canvasSize'
	| 'mediaDataUrls'
	| 'current'
	| 'activeSlide'
	| 'scale'
	| 'presenting'
	| 'presentationTransition'
	| 'onTransitionDone'
	| 'editingActive'
	| 'collabCursors'
	| 'collabPresences'
	| 'annotations'
	| 'guides'
	| 'onchangeguide'
	| 'spellCheck'
	| 'aiHighlights'
	| 'aiChangeBatch'
>;

/** Props of the horizontal + vertical ruler strips drawn around the stage. */
export interface RulerStripsProps {
	/** Slide dimensions in unscaled CSS px. */
	canvasSize: CanvasSize;
	/** Combined editor scale (fitScale * userZoom) the strips must track. */
	scale: number;
	/** Unit system for the labels. Defaults to inches. */
	unit?: RulerUnit;
	/** Extent of the selected element, highlighted on both strips. */
	selectedBounds?: { x: number; y: number; width: number; height: number } | null;
	/** Drag off a strip to drop a guide; omitted when guides are unavailable. */
	oncreateguide?: (axis: 'h' | 'v', position: number) => void;
}
