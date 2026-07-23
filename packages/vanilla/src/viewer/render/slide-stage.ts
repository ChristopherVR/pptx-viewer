import type {
	ParsedTableStyleMap,
	PptxElement,
	PptxSlide,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
} from 'pptx-viewer-core';
import type {
	CanvasSize,
	ElementAnimationState,
	FieldSubstitutionContext,
} from 'pptx-viewer-shared';
import {
	getAriaLabel,
	getAriaRole,
	getAriaRoleDescription,
	getSlideBackgroundStyle,
	isTemplateElementId,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from './dom';
import type { ElementRenderContext, ElementRendererRegistry } from './types';

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
	/** Opt-in WebGL SmartArt renderer flag; see `PptxViewerOptions.smartArt3D`. */
	smartArt3D?: boolean;
	/** True only for the live presentation stage; see `ElementRenderContext.presenting`. */
	presenting?: boolean;
	/** Full deck and active index used by presentation Zoom elements. */
	slides?: readonly PptxSlide[];
	currentSlideIndex?: number;
	onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void;
	onSmartArtNodeTextChange?: (element: PptxElement, nodeId: string, text: string) => void;
	onSmartArtNodeFillChange?: (element: PptxElement, nodeId: string, fill: string) => void;
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
		...getSlideBackgroundStyle(slide),
	});
	if (interactive) {
		stage.setAttribute('role', 'region');
		stage.setAttribute('aria-roledescription', 'slide');
		stage.setAttribute('aria-label', t('pptx.canvas.slide'));
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
		presenting: options.presenting ?? false,
		onSmartArtNodeTextChange: options.onSmartArtNodeTextChange,
		onSmartArtNodeFillChange: options.onSmartArtNodeFillChange,
		registry,
		renderElement(element: PptxElement, zIndex: number) {
			const node = registry.resolve(element.type)(element, zIndex, context);
			if (node && interactive && 'setAttribute' in node) {
				const templateLocked = isTemplateElementId(element.id) && !options.templateEditing;
				if (templateLocked) {
					node.style.pointerEvents = 'none';
					node.removeAttribute('data-pptx-element');
				} else {
					node.setAttribute('data-pptx-element', 'true');
				}
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

	return stage;
}

/**
 * Give every interactive rendered element the same shared accessibility
 * metadata used by React. This stays at the stage boundary so custom host
 * renderers receive it too, and thumbnails do not duplicate the slide's
 * screen-reader tree.
 */
function applyElementAccessibility(node: HTMLElement | SVGElement, element: PptxElement): void {
	const role = getAriaRole(element);
	if (role !== undefined) {
		node.setAttribute('role', role);
	}
	node.setAttribute('aria-label', getAriaLabel(element));
	const roleDescription = getAriaRoleDescription(element);
	if (roleDescription !== undefined) {
		node.setAttribute('aria-roledescription', roleDescription);
	}
}
