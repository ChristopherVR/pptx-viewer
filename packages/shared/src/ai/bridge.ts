/**
 * The {@link PptxAiBridge} contract each UI binding (React / Vue / Angular /
 * Svelte / Vanilla) implements so the framework-agnostic AI core can read the
 * open deck, navigate it, and route edits through the binding's own history /
 * undo stack.
 *
 * The bridge is the single seam between the AI core and a live editor: every
 * read goes through a getter, every mutation goes through one of the three
 * write choke points ({@link PptxAiBridge.applySlidesUpdate},
 * {@link PptxAiBridge.updateElement}, {@link PptxAiBridge.applyTheme}). Keeping
 * writes funnelled lets the {@link ProposalStore} commit a batch as a single
 * undoable history entry.
 */

import type { PptxData, PptxElement, PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';

/** Lightweight, model-friendly summary of the whole deck. */
export interface PptxAiDeckMeta {
	/** Total number of slides. */
	slideCount: number;
	/** Zero-based index of the currently active slide. */
	activeSlideIndex: number;
	/** Deck title, when known (first slide title / core properties). */
	title?: string;
	/** Slide canvas width in CSS pixels. */
	width: number;
	/** Slide canvas height in CSS pixels. */
	height: number;
}

/** Severity hint for {@link PptxAiBridge.notify}. */
export type PptxAiNotifyLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * A target the user has scoped the assistant to: either a whole slide or a
 * single element on a slide. Returned by {@link PptxAiBridge.getFocusedTargets}
 * so the context builder can tell the model exactly what to focus on.
 */
export type PptxAiFocusedTarget =
	| { kind: 'slide'; slideIndex: number }
	| { kind: 'element'; slideIndex: number; elementId: string };

/**
 * A pure updater over the deck's slides. It receives a deep clone of the
 * current slides (mutation-safe) and returns the next slides array. The bridge
 * commits the returned array as ONE history entry.
 */
export type PptxAiSlidesUpdater = (slides: PptxSlide[]) => PptxSlide[];

/**
 * A pure updater over the whole parsed deck ({@link PptxData}). Mirrors the
 * `pptx-viewer-mcp` tool model (data in, mutated data out) so presentation-level
 * MCP tools (metadata, sections, canvas size, presentation properties, layouts)
 * can be committed as ONE undoable history entry through {@link
 * PptxAiBridge.applyDeckData}. Optional: bindings that only track slide/theme
 * state can omit it, in which case those presentation-level tools report that
 * they are unavailable in this viewer while every slide/theme tool still works.
 */
export type PptxAiDataUpdater = (data: PptxData) => PptxData;

/** Field-level updates for a single element, mirroring the MCP update vocab. */
export interface PptxAiElementUpdate {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	rotation?: number;
	opacity?: number;
	hidden?: boolean;
	flipHorizontal?: boolean;
	flipVertical?: boolean;
	text?: string;
	fontSize?: number;
	fontFamily?: string;
	fontColor?: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	align?: 'left' | 'center' | 'right' | 'justify';
	fillColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
}

/**
 * Implemented by each binding to expose its live editor to the AI core.
 *
 * Read methods must be cheap and synchronous. Write methods must route through
 * the binding's editor-history layer so AI edits are undoable like manual ones.
 */
export interface PptxAiBridge {
	// ── reads ────────────────────────────────────────────────────────────────
	/** Return a summary of the whole deck. */
	getDeckMeta(): PptxAiDeckMeta;
	/** Return the deck's slides. Callers must not mutate the returned array. */
	getSlides(): PptxSlide[];
	/** Return the zero-based index of the active slide. */
	getActiveSlideIndex(): number;
	/** Return the resolved presentation theme, when available. */
	getTheme(): PptxTheme | undefined;
	/** Return the underlying core handler, when the binding exposes one. */
	getHandler(): PptxHandler | undefined;

	// ── navigation ───────────────────────────────────────────────────────────
	/** Navigate the viewer to a slide by zero-based index. */
	goToSlide(index: number): void;
	/** Select the given elements on a slide (empty array clears selection). */
	selectElements(slideIndex: number, elementIds: string[]): void;

	// ── write choke points ─────────────────────────────────────────────────────
	/**
	 * Apply a slides updater as a single, atomic, undoable history entry. The
	 * binding is responsible for cloning current slides before calling
	 * `updater` and for installing the result.
	 */
	applySlidesUpdate(updater: PptxAiSlidesUpdater, label: string): void;
	/** Apply field updates to one element as a single history entry. */
	updateElement(slideIndex: number, elementId: string, updates: PptxAiElementUpdate): void;
	/** Apply partial theme updates as a single history entry. */
	applyTheme(updates: Partial<PptxTheme>): void;

	// ── whole-deck reads/writes (optional) ─────────────────────────────────────
	/**
	 * Return the full parsed {@link PptxData} for the open deck, with the live
	 * (edited) slides and theme overlaid. Enables `pptx-viewer-mcp` tools that
	 * read presentation-level state (metadata, sections, layouts, presentation
	 * properties). Optional: when absent, the AI core synthesises a minimal
	 * PptxData from slides + dimensions, which is enough for every slide/theme
	 * tool but not for presentation-level reads.
	 */
	getDeckData?(): PptxData | undefined;
	/**
	 * Commit a whole-deck {@link PptxData} mutation as one undoable history entry.
	 * Used to apply presentation-level MCP tool results (metadata, sections,
	 * canvas size, presentation properties, layouts). Optional: when absent,
	 * those tools report they are not supported in this viewer; slide/theme tools
	 * are unaffected (they route through {@link PptxAiBridge.applySlidesUpdate}
	 * and {@link PptxAiBridge.applyTheme}).
	 */
	applyDeckData?(updater: PptxAiDataUpdater, label: string): void;

	// ── focus (optional) ───────────────────────────────────────────────────────
	/**
	 * Return the slides / elements the user has scoped the assistant to, if any.
	 * When present and non-empty, the context builder tells the model to focus on
	 * exactly these targets. Optional so existing bridges satisfy the contract
	 * without change; a bridge that does not implement it behaves as before (no
	 * focus scoping).
	 */
	getFocusedTargets?(): PptxAiFocusedTarget[];

	// ── ui (optional) ────────────────────────────────────────────────────────
	/** Surface a transient message in the host UI (toast / status line). */
	notify?(message: string, level?: PptxAiNotifyLevel): void;
}

/** Re-exported for binding convenience. */
export type { PptxData, PptxElement, PptxSlide, PptxTheme, PptxHandler };
