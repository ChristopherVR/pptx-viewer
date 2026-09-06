import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { GroupPptxElement, PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import {
	getComputedEffectStyle,
	getGroupChildParentFill,
	getImageFitStyle,
	strokeOutlineViewBox,
} from '../internal/shared';
import type {
	FillOverlayCss,
	ReflectionWrapperStyle,
	StrokeOutline,
	SubpathFillOverlay,
} from '../internal/shared';
import {
	getEffectFillOverlay,
	getSoftEdgeFilterDef,
	getStrokeOutline,
	getSubpathFillOverlay,
} from './element-effect-defs';
import type { SoftEdgeFilterDef } from './element-effect-defs';
import {
	getContainerStyle,
	getImageSrc,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
} from './element-style';
import type { StyleMap } from './element-style';
import { buildAngularParagraphs } from './paragraph-view';
import type { Paragraph } from './paragraph-view';
import { SlideTextBlockComponent } from './slide-text-block.component';

/**
 * ReflectionMirrorContent: the mirrored CONTENT painted inside a
 * `pptx-ng-reflection` wrapper (see `element-renderer.component.html`'s
 * `@if (reflection(); ...)` block), rendering the element's own fill,
 * outline, text body and - for a group - its children, not just its resolved
 * fill the way this app's earlier reflection wrapper only ever managed.
 *
 * Deliberately a SEPARATE, standalone component rather than a recursive
 * `pptx-element-renderer` mounted inertly: reusing the full interactive
 * renderer here would also pull in its editing/selection/chart-drag wiring
 * for a node that must never be interactive, selectable, or counted twice by
 * anything that walks the DOM by element id. Everything below is
 * `aria-hidden`/inert and carries no `data-element-id`.
 *
 * Text reuses `SlideTextBlockComponent` - the SAME component the live
 * renderer uses - so a mirror gets full fidelity (ruby annotation, inline
 * equations, tab-stop layout, per-script font pieces), not the simplified
 * plain-run re-paint this replaced. `interactive` is left at its default
 * `false`, so a hyperlink run here has no click handler, matching this
 * component's `aria-hidden`/inert contract.
 *
 * `topLevel` controls whether THIS invocation renders its OWN nested
 * reflection: `true` (the default) only for the element `getReflectionOverlay`
 * is building this whole mirror for, so it does not grow a mirror of its own
 * mirror; `false` for every recursive descendant (group child, or nested
 * group), so a child that carries its OWN `a:reflection` still shows it -
 * PowerPoint composites a reflected group from the group's fully-rendered
 * content, which already includes each child's own reflection where one is
 * set, so the child's mirror must appear a SECOND time here.
 */
@Component({
	selector: 'pptx-reflection-mirror-content',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, ReflectionMirrorContentComponent, SlideTextBlockComponent],
	template: `
		@if (isGroup()) {
			<div style="position: relative; width: 100%; height: 100%" [ngStyle]="boxStyle()">
				@if (softEdge(); as sef) {
					<svg
						width="0"
						height="0"
						aria-hidden="true"
						style="position: absolute; width: 0; height: 0; overflow: hidden"
					>
						<defs>
							<filter
								[attr.id]="sef.id"
								x="-20%"
								y="-20%"
								width="140%"
								height="140%"
								color-interpolation-filters="sRGB"
							>
								<feGaussianBlur
									in="SourceAlpha"
									[attr.stdDeviation]="sef.radius"
									result="softEdgeAlpha"
								/>
								<feComposite in="SourceGraphic" in2="softEdgeAlpha" operator="in" />
							</filter>
						</defs>
					</svg>
				}
				@for (child of children(); track child.id; let i = $index) {
					<div [ngStyle]="childContainerStyle(child, i)">
						<pptx-reflection-mirror-content
							[element]="child"
							[mediaDataUrls]="mediaDataUrls()"
							[parentGroupFill]="childParentGroupFill()"
							[topLevel]="false"
						/>
					</div>
				}
				@if (ownReflection(); as refl) {
					<div class="pptx-ng-reflection" aria-hidden="true" [ngStyle]="refl">
						<pptx-reflection-mirror-content
							[element]="element()"
							[mediaDataUrls]="mediaDataUrls()"
							[topLevel]="true"
						/>
					</div>
				}
			</div>
		} @else {
			<div style="width: 100%; height: 100%" [ngStyle]="boxStyle()">
				@if (subpathFill(); as sf) {
					<svg
						aria-hidden="true"
						[attr.viewBox]="'0 0 ' + sf.viewBoxWidth + ' ' + sf.viewBoxHeight"
						preserveAspectRatio="none"
						style="position: absolute; inset: 0; width: 100%; height: 100%"
					>
						@for (paint of sf.paints; track $index) {
							<path [attr.d]="paint.d" [attr.fill]="paint.fill" stroke="none" />
						}
					</svg>
				}
				@if (softEdge(); as sef) {
					<svg
						width="0"
						height="0"
						aria-hidden="true"
						style="position: absolute; width: 0; height: 0; overflow: hidden"
					>
						<defs>
							<filter
								[attr.id]="sef.id"
								x="-20%"
								y="-20%"
								width="140%"
								height="140%"
								color-interpolation-filters="sRGB"
							>
								<feGaussianBlur
									in="SourceAlpha"
									[attr.stdDeviation]="sef.radius"
									result="softEdgeAlpha"
								/>
								<feComposite in="SourceGraphic" in2="softEdgeAlpha" operator="in" />
							</filter>
						</defs>
					</svg>
				}
				@if (fillOverlay(); as ov) {
					<div
						aria-hidden="true"
						style="position: absolute; inset: 0; pointer-events: none"
						[style.background]="ov.color"
						[style.mix-blend-mode]="ov.blendMode"
					></div>
				}
				@if (strokeOutline(); as so) {
					<svg
						aria-hidden="true"
						[attr.viewBox]="outlineViewBox()"
						preserveAspectRatio="none"
						style="
							position: absolute;
							inset: 0;
							width: 100%;
							height: 100%;
							overflow: visible;
							pointer-events: none;
						"
					>
						@for (strand of so.strands; track $index) {
							<path
								[attr.d]="so.d"
								fill="none"
								[attr.stroke]="so.stroke"
								[attr.stroke-width]="strand.strokeWidth"
								[attr.stroke-dasharray]="so.dashArray"
								[attr.stroke-linecap]="so.lineCap"
								[attr.stroke-linejoin]="so.lineJoin"
							/>
						}
					</svg>
				}
				@if (imageSrc(); as src) {
					<img [src]="src" alt="" draggable="false" [ngStyle]="imageFitStyle()" />
				} @else if (hasText()) {
					<pptx-slide-text-block [paragraphs]="paragraphs()" [textStyle]="textStyle()" />
				}
				@if (ownReflection(); as refl) {
					<div class="pptx-ng-reflection" aria-hidden="true" [ngStyle]="refl">
						<pptx-reflection-mirror-content
							[element]="element()"
							[mediaDataUrls]="mediaDataUrls()"
							[topLevel]="true"
						/>
					</div>
				}
			</div>
		}
	`,
})
export class ReflectionMirrorContentComponent {
	readonly element = input.required<PptxElement>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	/** The enclosing (mirrored) group's fill, for an `a:grpFill` child. */
	readonly parentGroupFill = input<ShapeStyle | undefined>(undefined);
	/**
	 * `true` only for the element `getReflectionOverlay` is building THIS
	 * mirror for; `false` for every recursive descendant. Controls whether
	 * this node renders {@link ownReflection}: the top element must not grow
	 * a mirror of its own mirror, but a descendant is not the element being
	 * mirrored, so a child (or nested group) that carries its OWN
	 * `a:reflection` must still show it. See the class doc.
	 */
	readonly topLevel = input<boolean>(true);

	readonly isGroup = computed(() => this.element().type === 'group');
	readonly children = computed<PptxElement[]>(() =>
		this.isGroup() ? ((this.element() as GroupPptxElement).children ?? []) : [],
	);
	/** Chained `a:grpFill` resolution for this (mirrored) group's own children. */
	readonly childParentGroupFill = computed<ShapeStyle | undefined>(() =>
		getGroupChildParentFill(this.element(), this.parentGroupFill()),
	);
	readonly childContainerStyle = (child: PptxElement, i: number): StyleMap =>
		getContainerStyle(child, i);

	// `getShapeFillStrokeStyle` branches on `el.type === 'group'` itself
	// (shadow / glow / soft-edge filter for the group's own composite raster;
	// no fill / border, since a group paints neither), so this needs no group
	// ternary here.
	readonly boxStyle = computed<StyleMap>(() =>
		getShapeFillStrokeStyle(this.element(), this.parentGroupFill()),
	);
	/**
	 * This element's OWN nested `a:reflection` wrapper style, or `undefined`
	 * when it has none, or when this instance IS the element the enclosing
	 * mirror was already built for ({@link topLevel}).
	 */
	readonly ownReflection = computed<ReflectionWrapperStyle | undefined>(() =>
		this.topLevel() ? undefined : getComputedEffectStyle(this.element()).reflection,
	);
	readonly fillOverlay = computed<FillOverlayCss | undefined>(() =>
		getEffectFillOverlay(this.element()),
	);
	readonly softEdge = computed<SoftEdgeFilterDef | undefined>(() =>
		getSoftEdgeFilterDef(this.element()),
	);
	readonly strokeOutline = computed<StrokeOutline | undefined>(() =>
		getStrokeOutline(this.element()),
	);
	/** viewBox in the element's PAINTED box, which the outline path data is authored in. */
	readonly outlineViewBox = computed(() => strokeOutlineViewBox(this.element()));
	readonly subpathFill = computed<SubpathFillOverlay | undefined>(() =>
		getSubpathFillOverlay(this.element()),
	);

	readonly isImage = computed(() => isImageLikeElement(this.element()));
	readonly imageSrc = computed(() =>
		this.isImage() ? getImageSrc(this.element(), this.mediaDataUrls()) : undefined,
	);
	readonly imageFitStyle = computed<StyleMap>(() => getImageFitStyle(this.element()) as StyleMap);

	readonly paragraphs = computed<Paragraph[]>(() => buildAngularParagraphs(this.element()));
	readonly hasText = computed(() => this.paragraphs().some((p) => p.runs.length > 0));
	readonly textStyle = computed<StyleMap>(() => getTextBlockStyle(this.element()));
}
