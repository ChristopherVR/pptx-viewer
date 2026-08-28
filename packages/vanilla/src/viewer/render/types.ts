import type {
	ParsedTableStyleMap,
	PptxChartData,
	PptxElement,
	PptxSlide,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
} from 'pptx-viewer-core';
import type {
	CanvasSize,
	ChartPartRef,
	CssStyleMap,
	ElementAnimationState,
	FieldSubstitutionContext,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';

/** Discriminant values of the {@link PptxElement} union (`'text'`, `'chart'`, ...). */
export type PptxElementType = PptxElement['type'];

/**
 * A selected chart sub-part, scoped to the chart element that owns it. The
 * vanilla counterpart of React's `ChartPartSelectionContext` / Vue's
 * `ChartPartSelection` / Angular's `ChartPartSelectionService`: the bridge
 * between an on-canvas mark click (`chart-editable.ts`) and the chart
 * inspector (`chart-data-grid.ts` / `chart-point-index.ts`), threaded through
 * the store rather than component context since vanilla has no such
 * injection mechanism.
 */
export interface ChartPartSelection {
	elementId: string;
	part: ChartPartRef;
}

/**
 * Everything an element renderer may need, passed to every renderer call.
 *
 * The context is immutable per slide render. Renderers must create DOM through
 * `context.document` (never the global `document`) so slides can render into
 * detached documents (tests, export pipelines).
 */
export interface ElementRenderContext {
	/** Document used for all DOM creation. */
	readonly document: Document;
	/** The slide being rendered. */
	readonly slide: PptxSlide;
	/** Full deck, used by Zoom elements to resolve their target preview. */
	readonly slides?: readonly PptxSlide[];
	/** Zero-based active slide index for Zoom return navigation. */
	readonly currentSlideIndex?: number;
	/** Presentation-only Zoom tile activation callback. */
	readonly onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void;
	/** Full slide canvas size in CSS px (elements are positioned in this space). */
	readonly canvasSize: CanvasSize;
	/**
	 * The scale the stage is rendered at (1 = 100%). The stage applies it via a
	 * CSS transform, so renderers should lay out in unscaled canvas px; `scale`
	 * is informational (e.g. for raster density decisions).
	 */
	readonly scale: number;
	/** Archive-path to displayable URL map for media + poster frames. */
	readonly mediaDataUrls: ReadonlyMap<string, string>;
	/** Presentation theme colour scheme used by theme-aware render helpers. */
	readonly colorScheme?: PptxThemeColorScheme;
	/**
	 * Presentation theme font scheme, so table styles resolve their
	 * `a:fontRef@idx` (`minor`/`major`) to a concrete font family.
	 */
	readonly fontScheme?: PptxThemeFontScheme;
	/** Parsed `ppt/tableStyles.xml` definitions used by table band/header styling. */
	readonly tableStyleMap?: ParsedTableStyleMap;
	readonly fieldContext?: FieldSubstitutionContext;
	/** Shared-dictionary translator (`pptx.*` keys). */
	readonly t: Translator;
	/**
	 * Opt-in flag: render `smartArt` elements as an extruded Three.js scene
	 * instead of flat SVG (see `PptxViewerOptions.smartArt3D`). Defaults to
	 * `false` when the option is unset.
	 */
	readonly smartArt3D: boolean;
	/**
	 * Opt-in flag: render `surface`/`surface3D` charts as an interactive,
	 * camera-orbitable Three.js mesh instead of the static SVG isometric
	 * projection (see `PptxViewerOptions.surfaceChart3D`). Defaults to `false`
	 * when the option is unset.
	 */
	readonly surfaceChart3D: boolean;
	/**
	 * Opt-in flag: render `bar3D` charts as an interactive, camera-orbitable
	 * Three.js box-mesh scene instead of the flat SVG oblique-projection
	 * illusion (see `PptxViewerOptions.barChart3D`). Defaults to `false` when
	 * the option is unset.
	 */
	readonly barChart3D: boolean;
	/**
	 * Opt-in flag: render `line3D` charts as an interactive, camera-orbitable
	 * Three.js tube-path scene instead of the flat SVG oblique-projection
	 * illusion (see `PptxViewerOptions.lineChart3D`). Defaults to `false` when
	 * the option is unset.
	 */
	readonly lineChart3D: boolean;
	/**
	 * Opt-in flag: render `area3D` charts as an interactive, camera-orbitable
	 * Three.js tube-path + ribbon-fill scene instead of the flat SVG
	 * oblique-projection illusion (see `PptxViewerOptions.areaChart3D`).
	 * Defaults to `false` when the option is unset.
	 */
	readonly areaChart3D: boolean;
	/**
	 * Opt-in flag: render `pie3D` charts as an interactive, camera-orbitable
	 * Three.js wedge-mesh scene instead of the flat SVG oblique-projection
	 * illusion (see `PptxViewerOptions.pieChart3D`). Defaults to `false` when
	 * the option is unset.
	 */
	readonly pieChart3D: boolean;
	/**
	 * True only for the live presentation stage (real Fullscreen API active):
	 * media renderers use this to autoplay once mounted, matching PowerPoint's
	 * slideshow behaviour. `false` for the editor canvas and thumbnail rail.
	 */
	readonly presenting: boolean;
	/**
	 * True only for the surface the user is authoring on. `false` for every
	 * still of a slide (thumbnail rail, presenter console panes, export raster)
	 * AND for the live show stage, which is driven, not edited.
	 *
	 * Media reads it: a stage that is neither interactive nor presenting is a
	 * still, and a still never carries the browser's native transport (see the
	 * shared `mediaTransportVisible`). Optional so the many hand-built contexts
	 * in tests keep compiling; the stage always sets it.
	 */
	readonly interactive?: boolean;
	readonly onSmartArtNodeTextChange?: (element: PptxElement, nodeId: string, text: string) => void;
	readonly onSmartArtNodeFillChange?: (element: PptxElement, nodeId: string, fill: string) => void;
	/**
	 * Commit a table's whole column-width array after a column-boundary drag.
	 * Called once on pointer release (the drag itself only translates the
	 * boundary handle), so one drag is one undo step. Absent on every
	 * non-authoring surface, matching `onSmartArtNodeTextChange`.
	 */
	readonly onTableResizeColumns?: (element: PptxElement, widths: number[]) => void;
	/** Commit one row's new pixel height after a row-boundary drag. */
	readonly onTableResizeRow?: (element: PptxElement, rowIndex: number, height: number) => void;
	/**
	 * Commit a chart data point dragged on the canvas, with the whole updated
	 * `chartData`. Called ONCE on pointer release (the drag itself is a local
	 * preview), so one drag is one undo step. Absent on every non-authoring
	 * surface, which is what keeps thumbnails and the show stage inert.
	 */
	readonly onChartPointChange?: (element: PptxElement, chartData: PptxChartData) => void;
	/**
	 * The current on-canvas chart part selection (shared with the inspector via
	 * the store), or `null`/absent when nothing is selected. Read by
	 * `chart-editable.ts` to seed its highlight on (re)mount, so the ring stays
	 * on the clicked mark across a stage rebuild triggered by an unrelated edit.
	 */
	readonly chartPartSelection?: ChartPartSelection | null;
	/**
	 * A chart part (bar / dot / slice / series line) was pressed on the canvas.
	 * Surfaces the selection to the chart inspector (ring-highlight + scroll in
	 * `chart-data-grid.ts`, point sync in `chart-point-index.ts`). Absent on
	 * every non-authoring surface, matching `onChartPointChange`.
	 */
	readonly onChartPartSelect?: (element: PptxElement, part: ChartPartRef) => void;
	/**
	 * Per-element native-animation playback state, keyed by element id, present
	 * only during a running presentation. Chart / SmartArt renderers read their
	 * element's {@link ElementAnimationState.build} to reveal a staged build
	 * (`p:bldChart` / `p:bldDgm`); shape renderers read `animatesFill` /
	 * `animatesStroke` to relinquish static paint during a `p:animClr` animation.
	 * A stable map instance, mutated in place by the playback controller so a
	 * targeted single-element re-render always reads current state.
	 */
	readonly presentationStates?: ReadonlyMap<string, ElementAnimationState>;
	/** The registry in effect, for renderers that need to inspect it. */
	readonly registry: ElementRendererRegistry;
	/**
	 * Render a child element through the registry (used by the group renderer
	 * for recursion; custom renderers may nest elements the same way).
	 */
	renderElement(element: PptxElement, zIndex: number): HTMLElement | SVGElement | null;
}

/**
 * Renders one slide element to a DOM node (or `null` to render nothing).
 *
 * Contract:
 * - Position absolutely within the stage: apply the shared
 *   `getContainerStyle(element, zIndex)` map (or equivalent) to the returned
 *   root node.
 * - Set `dataset.elementId = element.id` on the root node.
 * - Create all DOM via `context.document`.
 * - Never mutate `element` or anything on the context.
 */
export type ElementRenderer = (
	element: PptxElement,
	zIndex: number,
	context: ElementRenderContext,
) => HTMLElement | SVGElement | null;

/**
 * Registry dispatching elements to renderers by their `type` discriminant.
 *
 * Additional element types are supported by registering a renderer for the
 * type; unregistered types fall through to the fallback renderer (a typed
 * placeholder box by default). See `render/elements/README.md` for the
 * step-by-step contract.
 */
export interface ElementRendererRegistry {
	/** Register (or replace) the renderer for an element type. */
	register(type: PptxElementType, renderer: ElementRenderer): void;
	/** Remove the renderer for an element type (falls back afterwards). */
	unregister(type: PptxElementType): void;
	/** The renderer registered for a type, or `undefined`. */
	get(type: PptxElementType): ElementRenderer | undefined;
	/** True when a dedicated (non-fallback) renderer is registered. */
	has(type: PptxElementType): boolean;
	/** Replace the fallback renderer used for unregistered types. */
	setFallback(renderer: ElementRenderer): void;
	/** The renderer to use for a type: registered renderer or fallback. */
	resolve(type: PptxElementType): ElementRenderer;
	/** All types with a dedicated renderer (sorted, for tests/debugging). */
	registeredTypes(): PptxElementType[];
}

/** Re-export of the shared plain CSS style map used by all style builders. */
export type { CssStyleMap };
