/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (many independent short-lived `const`s assembling the render context and
   the stage node); merging them isn't a style choice here. */
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
	ElementAnimationState,
	FieldSubstitutionContext,
} from 'pptx-viewer-shared';
import {
	actionAffordanceLabels,
	applyElementActionAffordances,
	getAriaLabel,
	getAriaRole,
	getAriaRoleDescription,
	getSlideBackgroundStyle,
	isElementActionable,
	isElementRendered,
	isTemplateElementId,
	PRESENTATION_STAGE_ATTRIBUTE,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { buildActiveXControlsOverlay } from './activex-controls-overlay';
import { createEl } from './dom';
import type { ChartPartSelection, ElementRenderContext, ElementRendererRegistry } from './types';

export interface SlideStageOptions {
	document: Document;
	slide: PptxSlide;
	canvasSize: CanvasSize;
	mediaDataUrls: ReadonlyMap<string, string>;
	/** Optional presentation theme colour scheme for element renderers. */
	colorScheme?: PptxThemeColorScheme;
	/** Optional presentation theme font scheme for table-style font resolution. */
	fontScheme?: PptxThemeFontScheme;
	/** Optional parsed table-style definitions for theme-aware table rendering. */
	tableStyleMap?: ParsedTableStyleMap;
	fieldContext?: FieldSubstitutionContext;
	registry: ElementRendererRegistry;
	t: Translator;
	/** Scale applied via CSS transform (default 1). */
	scale?: number;
	/**
	 * Grid dot/line spacing in CSS px for the View > Grid overlay (`.pptxv-showGrid`),
	 * derived by the caller from the deck's authored `viewProperties.gridSpacing`
	 * via `computeGridSpacingPx`. Defaults to 10px (this binding's existing grid
	 * step) when omitted.
	 */
	gridSpacingPx?: number;
	/** Opt-in WebGL SmartArt renderer flag; see `PptxViewerOptions.smartArt3D`. */
	smartArt3D?: boolean;
	/**
	 * Opt-in interactive WebGL surface-chart renderer flag; see
	 * `PptxViewerOptions.surfaceChart3D`.
	 */
	surfaceChart3D?: boolean;
	/**
	 * Opt-in interactive WebGL bar3D-chart renderer flag; see
	 * `PptxViewerOptions.barChart3D`.
	 */
	barChart3D?: boolean;
	/**
	 * Opt-in interactive WebGL line3D-chart renderer flag; see
	 * `PptxViewerOptions.lineChart3D`.
	 */
	lineChart3D?: boolean;
	/**
	 * Opt-in interactive WebGL area3D-chart renderer flag; see
	 * `PptxViewerOptions.areaChart3D`.
	 */
	areaChart3D?: boolean;
	/**
	 * Opt-in interactive WebGL pie3D-chart renderer flag; see
	 * `PptxViewerOptions.pieChart3D`.
	 */
	pieChart3D?: boolean;
	/** True only for the live presentation stage; see `ElementRenderContext.presenting`. */
	presenting?: boolean;
	/** Full deck and active index used by presentation Zoom elements. */
	slides?: readonly PptxSlide[];
	currentSlideIndex?: number;
	onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void;
	onSmartArtNodeTextChange?: (element: PptxElement, nodeId: string, text: string) => void;
	onSmartArtNodeFillChange?: (element: PptxElement, nodeId: string, fill: string) => void;
	/** See `ElementRenderContext.onChartPointChange`. */
	readonly onChartPointChange?: (element: PptxElement, chartData: PptxChartData) => void;
	/** See `ElementRenderContext.onTableResizeColumns`. */
	readonly onTableResizeColumns?: (element: PptxElement, widths: number[]) => void;
	/** See `ElementRenderContext.onTableResizeRow`. */
	readonly onTableResizeRow?: (element: PptxElement, rowIndex: number, height: number) => void;
	/** See `ElementRenderContext.chartPartSelection`. */
	readonly chartPartSelection?: ChartPartSelection | null;
	/** See `ElementRenderContext.onChartPartSelect`. */
	readonly onChartPartSelect?: (element: PptxElement, part: ChartPartRef) => void;
	/** See `ElementRenderContext.selectedElementIds`. */
	readonly selectedElementIds?: ReadonlySet<string>;
	/**
	 * True only for the main (interactive) canvas, never the thumbnail rail.
	 * Marks every rendered element (recursively, including group children) with
	 * `data-pptx-element="true"` and the stage itself with
	 * `role="region" aria-roledescription="slide"` - the framework-neutral e2e
	 * test hooks the React/Vue/Angular bindings also emit. Defaults to `false`.
	 */
	interactive?: boolean;
	/** Whether inherited layout/master nodes participate in editing. */
	templateEditing?: boolean;
	/** Per-element native-animation playback state (presentation mode only). */
	presentationStates?: ReadonlyMap<string, ElementAnimationState>;
	/**
	 * Invoked with the built render context once the stage is assembled. Lets the
	 * presentation playback re-render single elements (staged chart / SmartArt
	 * build, `p:animClr` fill / stroke) in place without rebuilding the stage.
	 */
	captureContext?: (context: ElementRenderContext) => void;
}

/**
 * Render one slide as a fixed-size stage: the resolved slide background plus
 * every element dispatched through the registry, scaled with a CSS transform
 * (`transform-origin: top left`), exactly like the other bindings' stages.
 *
 * The returned node is `canvasSize * scale` ON SCREEN but laid out at the
 * unscaled canvas size, so the caller should wrap it in a box sized to
 * `canvasSize * scale` (the viewer's stage host and thumbnails both do).
 */
export function renderSlideStage(options: SlideStageOptions): HTMLElement {
	const { document: doc, slide, canvasSize, mediaDataUrls, registry, t } = options;
	const scale = options.scale ?? 1;
	const interactive = options.interactive ?? false;

	const stage = createEl(doc, 'div', 'pptxv-stage', {
		width: `${canvasSize.width}px`,
		height: `${canvasSize.height}px`,
		transform: `scale(${scale})`,
		transformOrigin: 'top left',
		position: 'relative',
		overflow: 'hidden',
		// Motion-path keyframes translate by a fraction of the SLIDE (a CSS
		// `translate(%)` would resolve against the ELEMENT box instead and make a
		// small shape barely move), so every stage publishes its own size for
		// those `calc()` offsets. Set here rather than at the call sites so the
		// editing stage and the presentation stage can never disagree.
		'--pptx-slide-w': `${canvasSize.width}px`,
		'--pptx-slide-h': `${canvasSize.height}px`,
		'--pptxv-grid-size': `${options.gridSpacingPx ?? 10}px`,
		...getSlideBackgroundStyle(slide),
	});
	if (interactive) {
		stage.setAttribute('role', 'region');
		stage.setAttribute('aria-roledescription', 'slide');
		stage.setAttribute('aria-label', t('pptx.canvas.slide'));
	}
	// Marks a RUNNING show so `PRESENTATION_HIT_TEST_CSS` makes its scenery
	// pointer-transparent: only action shapes, media transport and links take a
	// click, exactly as in PowerPoint. The other bindings get this attribute
	// from the shared accessibility pass, which this stage does not use.
	if (options.presenting) {
		stage.setAttribute(PRESENTATION_STAGE_ATTRIBUTE, 'true');
	}

	const context: ElementRenderContext = {
		document: doc,
		slide,
		slides: options.slides,
		currentSlideIndex: options.currentSlideIndex,
		onZoomClick: options.onZoomClick,
		canvasSize,
		scale,
		mediaDataUrls,
		colorScheme: options.colorScheme,
		fontScheme: options.fontScheme,
		tableStyleMap: options.tableStyleMap,
		fieldContext: options.fieldContext,
		presentationStates: options.presentationStates,
		t,
		smartArt3D: options.smartArt3D ?? false,
		surfaceChart3D: options.surfaceChart3D ?? false,
		barChart3D: options.barChart3D ?? false,
		lineChart3D: options.lineChart3D ?? false,
		areaChart3D: options.areaChart3D ?? false,
		pieChart3D: options.pieChart3D ?? false,
		presenting: options.presenting ?? false,
		interactive,
		onSmartArtNodeTextChange: options.onSmartArtNodeTextChange,
		onSmartArtNodeFillChange: options.onSmartArtNodeFillChange,
		onChartPointChange: options.onChartPointChange,
		onTableResizeColumns: options.onTableResizeColumns,
		onTableResizeRow: options.onTableResizeRow,
		chartPartSelection: options.chartPartSelection,
		onChartPartSelect: options.onChartPartSelect,
		selectedElementIds: options.selectedElementIds,
		registry,
		renderElement(element: PptxElement, zIndex: number) {
			// Hidden via the Selection Pane: build no node at all, exactly as
			// PowerPoint draws nothing for it. This is the ONE choke point every
			// surface goes through (canvas, group children, thumbnails, the master
			// rail and the offscreen export raster), so the rule lands everywhere
			// from here. Returning `null` is already the contract for "nothing to
			// render", and both the stage loop and the group renderer skip it.
			if (!isElementRendered(element)) {
				return null;
			}
			const node = registry.resolve(element.type)(element, zIndex, context);
			if (node && interactive && 'setAttribute' in node) {
				// The element marker means "rendered slide element carrying the
				// contract", not "editable right now": an interaction-locked template
				// (master/layout) element keeps it, matching the other bindings, and
				// only loses pointer interactivity.
				const templateLocked = isTemplateElementId(element.id) && !options.templateEditing;
				if (templateLocked) {
					node.style.pointerEvents = 'none';
				}
				node.setAttribute('data-pptx-element', 'true');
				applyElementAccessibility(node, element);
			}
			return node;
		},
	};

	options.captureContext?.(context);

	slide.elements.forEach((element, index) => {
		const node = context.renderElement(element, index);
		if (node) {
			stage.appendChild(node);
		}
	});

	// Authoring chrome for an Action Setting (amber "has action" badge + hover
	// link tooltip). Applied here, once the stage is assembled, rather than
	// inside each element renderer: the registry hands every type its own root
	// node, so a per-renderer copy would be a dozen duplicates of the same
	// markup. An inherited master/layout shape only gets it while template
	// editing is on, matching the interaction gate above.
	if (interactive) {
		applyElementActionAffordances(
			stage,
			slide.elements.filter(
				(element) => options.templateEditing || !isTemplateElementId(element.id),
			),
			{
				canInteract: true,
				presenting: options.presenting ?? false,
				labels: actionAffordanceLabels((key) => t(key)),
			},
		);
	}

	// ActiveX controls (`p:controls > p:control`) cannot run inside a viewer.
	// Draw each one's static fallback picture when core resolved one, otherwise
	// a labelled placeholder badge, so the slide shows where the control lives
	// instead of a blank gap (React-only before this; the other bindings drew
	// nothing).
	if (slide.activeXControls && slide.activeXControls.length > 0) {
		stage.appendChild(buildActiveXControlsOverlay(doc, slide.activeXControls, canvasSize));
	}

	return stage;
}

/**
 * Give every interactive rendered element the same shared accessibility
 * metadata used by React. This stays at the stage boundary so custom host
 * renderers receive it too, and thumbnails do not duplicate the slide's
 * screen-reader tree.
 */
function applyElementAccessibility(node: HTMLElement | SVGElement, element: PptxElement): void {
	// Actionable elements (click/hover action, text hyperlink, zoom tile) are
	// announced as buttons, matching React's element renderer.
	const actionable = isElementActionable(element);
	// The neutral marker `PRESENTATION_INERT_CLICK_SELECTOR` keys off: an
	// element that owns its own click must never also step the slide show on.
	if (actionable) {
		node.setAttribute('data-pptx-action', 'click');
	} else {
		node.removeAttribute('data-pptx-action');
	}
	const role = getAriaRole(element, { actionable });
	if (role !== undefined) {
		node.setAttribute('role', role);
	}
	node.setAttribute('aria-label', getAriaLabel(element));
	const roleDescription = getAriaRoleDescription(element);
	if (roleDescription !== undefined) {
		node.setAttribute('aria-roledescription', roleDescription);
	}
}
