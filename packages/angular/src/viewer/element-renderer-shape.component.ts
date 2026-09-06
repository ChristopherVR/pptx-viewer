import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';

import {
	build3DExtrusionData,
	buildHollowHitOutline,
	buildTextBody3DSceneStyle,
	getOverflowSegments,
	placeholderPromptDescriptor,
	strokeOutlineViewBox,
} from '../internal/shared';
import type {
	ElementAnimationState,
	Extrusion3DData,
	FieldSubstitutionContext,
} from '../internal/shared';
import { DynamicStyleComponent } from './dynamic-style.component';
import {
	getEffectFillOverlay,
	getReflectionOverlay,
	getStrokeOutline,
	getSubpathFillOverlay,
} from './element-effect-defs';
import type { ReflectionOverlay } from './element-effect-defs';
import { getTextBlockStyle } from './element-style';
import type { StyleMap } from './element-style';
import { Extrusion3DOverlayComponent } from './extrusion-3d-overlay.component';
import { buildAngularParagraphs } from './paragraph-view';
import type { Paragraph } from './paragraph-view';
import { ReflectionMirrorContentComponent } from './reflection-mirror-content.component';
import { SlideTextBlockComponent } from './slide-text-block.component';
import { getTextWarp } from './text-warp';
import type { TextWarpGlyphDef, TextWarpPathDef } from './text-warp';

/**
 * The `text` / `shape` branch of `ElementRendererComponent`: fill/stroke box,
 * 3D extrusion, reflection, hollow hit outline, gradient outline, WordArt
 * warp (glyph or SVG textPath), and the rich text block itself.
 *
 * Split out purely to keep `ElementRendererComponent`'s `.ts`/`.html` under
 * the file-size limit (this branch alone was over 280 lines of template).
 * Everything computed here is exclusive to this branch; values shared with
 * the `group` branch that stayed on the parent (`shapeContainerStyle`,
 * `elementIdAttr`, `rootPointerEvents`, ...) are threaded down as inputs
 * instead of being recomputed, so there is exactly one place each is worked
 * out. `reflection` is the one exception: it is cheap (a single shared-helper
 * call keyed only on `element()`), and `ImageRendererComponent` already
 * recomputes it locally rather than accepting it as an input, so this
 * component follows that existing convention.
 */
@Component({
	selector: 'pptx-element-renderer-shape',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgStyle,
		DynamicStyleComponent,
		Extrusion3DOverlayComponent,
		ReflectionMirrorContentComponent,
		SlideTextBlockComponent,
	],
	templateUrl: './element-renderer-shape.component.html',
})
export class ElementRendererShapeComponent {
	readonly element = input.required<PptxElement>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly shapeContainerStyle = input<StyleMap>({});
	readonly rootPointerEvents = input<'none' | null>(null);
	readonly elementIdAttr = input<string | null>(null);
	readonly elementMarked = input<boolean>(false);
	readonly textStyleOverrideCss = input<string | undefined>(undefined);
	readonly editable = input<boolean>(false);
	readonly presenting = input<boolean>(false);
	readonly fieldContext = input<FieldSubstitutionContext | undefined>(undefined);
	readonly slideElements = input<readonly PptxElement[]>([]);
	readonly subElementAnimStates = input<ReadonlyMap<string, ElementAnimationState> | undefined>(
		undefined,
	);

	/**
	 * The element currently open in the element-level inline text editor, or
	 * `null`. See `ElementRendererComponent.editingElementId`'s doc.
	 */
	readonly editingElementId = input<string | null>(null);

	/** This exact element is open in the element-level inline text editor right now. */
	readonly isBeingInlineEdited = computed(() => this.element().id === this.editingElementId());

	/** `a:reflection` mirrored-sibling descriptor, or `undefined`. */
	readonly reflection = computed<ReflectionOverlay | undefined>(() =>
		getReflectionOverlay(this.element()),
	);

	/**
	 * Per-sub-path fill overlay for a multi-sub-path preset or custom geometry,
	 * or `undefined` when a single merged fill is correct (the ordinary case).
	 */
	readonly subpathFill = computed(() => getSubpathFillOverlay(this.element()));

	/** `viewBox` for the sub-path fill overlay, in its own coordinate space. */
	readonly subpathFillViewBox = computed(() => {
		const overlay = this.subpathFill();
		return overlay ? `0 0 ${overlay.viewBoxWidth} ${overlay.viewBoxHeight}` : undefined;
	});

	/**
	 * DAG fill-overlay tint (colour + blend mode) painted as a separate blended
	 * layer over the shape. Undefined when the element has no fill overlay.
	 */
	readonly fillOverlay = computed(() => getEffectFillOverlay(this.element()));

	/**
	 * CSS 3D extrusion side-panel data for shapes with `a:sp3d` extrusion depth.
	 * Mirrors React/Vue/Svelte/Vanilla: real extruded faces are rendered as
	 * `<div>` panels by `Extrusion3DOverlayComponent` (the flat `box-shadow`
	 * approximation from `getShapeFillStrokeStyle`/`merge3dStyleMap` is kept
	 * underneath, as in the other bindings).
	 */
	readonly extrusionData = computed<Extrusion3DData>(() => {
		const el = this.element();
		const ss = hasShapeProperties(el) ? el.shapeStyle : undefined;
		return build3DExtrusionData(ss?.shape3d, ss?.scene3d, ss?.fillColor, el.width, el.height);
	});

	/**
	 * Stroked SVG outline: a gradient / pattern `a:ln`, or a stroke-only
	 * ("open") preset such as `line` or `arc`, neither of which a CSS border
	 * can paint.
	 */
	readonly gradientOutline = computed(() => getStrokeOutline(this.element()));

	/** viewBox in the element's PAINTED box, which the path data is authored in. */
	readonly outlineViewBox = computed(() => strokeOutlineViewBox(this.element()));

	/**
	 * Transparent outline hit band for an unfilled, textless shape. Its container
	 * is `pointer-events: none` so clicks fall through to whatever it is drawn
	 * over; this opts the OUTLINE back in (same trick as the connector target).
	 */
	readonly hollowHit = computed(() => buildHollowHitOutline(this.element()));

	readonly textStyle = computed<StyleMap>(() => getTextBlockStyle(this.element()));
	/** Text-warp (WordArt) descriptor for the element, if any. */
	readonly textWarp = computed(() => getTextWarp(this.element(), this.fieldContext()));
	/** Only the SVG-textPath warp variant (for the `<svg>` overlay branch). */
	readonly pathWarp = computed<TextWarpPathDef | undefined>(() => {
		const w = this.textWarp();
		return w?.strategy === 'path' ? w : undefined;
	});
	/** Only the true two-curve envelope (glyph) warp variant, see `text-warp-glyph.ts`. */
	readonly glyphWarp = computed<TextWarpGlyphDef | undefined>(() => {
		const w = this.textWarp();
		return w?.strategy === 'glyph' ? w : undefined;
	});
	/** Text block 3D scene style (a:bodyPr/a:scene3d), mirroring React's ElementBody. */
	readonly scene3dStyle = computed<StyleMap | undefined>(() => {
		const el = this.element();
		const textStyleRaw = hasTextProperties(el) ? el.textStyle : undefined;
		return buildTextBody3DSceneStyle(textStyleRaw, { width: el.width, height: el.height });
	});

	/**
	 * Text block style, folding in a CSS-transform warp and the 3D scene
	 * (perspective + rotation) when present. The warp transform and the scene
	 * transform are composed rather than clobbering each other.
	 */
	readonly warpedTextStyle = computed<StyleMap>(() => {
		const base = this.textStyle();
		const scene = this.scene3dStyle();
		const merged: StyleMap = scene ? { ...base, ...scene } : { ...base };
		// A text block can carry its own transform (vertical writing modes), so
		// the scene transform is composed onto it rather than replacing it.
		if (base['transform'] && scene?.transform) {
			merged['transform'] = `${String(base['transform'])} ${String(scene.transform)}`;
		}
		const w = this.textWarp();
		// `getTextWarp` no longer produces `strategy: 'css'` (every classified
		// preset now resolves to `'path'`, see `text-warp.ts`); this branch is
		// kept only in case a future preset is classified without SVG support.
		if (w?.strategy === 'css') {
			const composed = merged['transform'];
			merged['transform'] = composed ? `${w.cssTransform} ${String(composed)}` : w.cssTransform;
			merged['transform-origin'] = w.cssTransformOrigin;
		}
		return merged;
	});

	readonly paragraphs = computed<Paragraph[]>(() => {
		const el = this.element();
		if (!hasTextProperties(el)) {
			return [];
		}
		// `a:linkedTxbx`: when this box is part of a linked chain it paints the
		// slice of the chain's text the preceding boxes could not hold, NOT its own
		// authored segments. The shared helper returns undefined (one field check)
		// for the overwhelmingly common non-chain element, so the fallback below is
		// the normal path. Everything downstream (autofit scale, paragraph indents,
		// bullets) still reads the element itself, exactly as React does.
		const segments = getOverflowSegments(el, this.slideElements()) ?? el.textSegments;
		return buildAngularParagraphs(el, this.fieldContext(), segments);
	});

	readonly hasText = computed(() =>
		this.paragraphs().some(
			(p) => p.runs.length > 0 || p.bulletMarker !== undefined || p.bulletPicture !== undefined,
		),
	);

	/**
	 * An empty inherited placeholder's greyed-out hint ("Click to add title"),
	 * or null when it should not be shown. `editable` is only ever set true on
	 * the live editing canvas (Present Mode leaves it at its `false` default,
	 * and the thumbnail rail passes it explicitly false), matching shared's
	 * `'edit'`-only surface: PowerPoint never prints, presents or thumbnails
	 * this authoring hint.
	 */
	readonly placeholderPrompt = computed<{ text: string; style: StyleMap } | null>(() => {
		const descriptor = placeholderPromptDescriptor(
			this.element(),
			this.editable() && !this.presenting() ? 'edit' : 'present',
		);
		if (!descriptor) {
			return null;
		}
		return {
			text: descriptor.text,
			style: {
				opacity: descriptor.style['opacity'] ?? '0.5',
				color: descriptor.style['color'] ?? '#888888',
				'pointer-events': descriptor.style['pointerEvents'] ?? 'none',
			},
		};
	});
}
