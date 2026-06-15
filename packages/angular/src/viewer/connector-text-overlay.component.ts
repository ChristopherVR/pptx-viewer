/**
 * Connector text overlay — Angular port of the Vue `ConnectorTextOverlay.vue`
 * (packages/vue/src/viewer/components/ConnectorTextOverlay.vue).
 *
 * Renders a connector's label text centred over the connector's bounding box.
 * PowerPoint allows authors to attach a text run to a connector element
 * (`<p:cxnSp>` with a non-empty `<p:txBody>`); the label is painted on top of
 * the connector path, centred both horizontally and vertically within the
 * element's bounding box.
 *
 * The overlay is an absolutely-positioned flex container rendered as a sibling
 * of the SVG connector — NOT part of the SVG — so per-segment rich text
 * renders with standard HTML text layout. It is `pointer-events: none` and
 * never intercepts selection or hit-testing on the connector beneath it.
 *
 * ### Pure label-geometry helper
 * All positioning / style math lives in the exported pure functions
 * `buildOverlayContainerStyle`, `buildOverlayBlockStyle`, and `buildSegmentStyle`
 * so they can be unit-tested without TestBed (see
 * `connector-text-overlay.component.test.ts`).
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TextSegment, TextStyle } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Pure exported helpers (tested independently, no Angular dependency)
// ---------------------------------------------------------------------------

/**
 * Inline style string for the outer overlay container.
 *
 * The container fills the connector bounding box, uses flexbox to centre
 * content, and is `pointer-events: none`.
 *
 * @param align - OOXML paragraph alignment token. Variants `justLow`, `dist`,
 *   and `thaiDist` collapse to `justify`; every other value passes through;
 *   absent → `center` (connector-label convention).
 */
export function buildOverlayContainerStyle(align: TextStyle['align'] | undefined): string {
	let textAlign: string;
	if (align === 'justLow' || align === 'dist' || align === 'thaiDist') {
		textAlign = 'justify';
	} else if (align !== undefined) {
		textAlign = align;
	} else {
		textAlign = 'center';
	}

	return [
		'position:absolute',
		'inset:0',
		'display:flex',
		'align-items:center',
		'justify-content:center',
		'overflow:hidden',
		'pointer-events:none',
		`text-align:${textAlign}`,
	].join(';');
}

/**
 * Inline style string for the inner text-block `<div>`.
 *
 * Applies paragraph-level defaults: font family, size, colour, weight, style,
 * and decoration from `textStyle`, with sensible fall-backs for connector
 * labels (10pt, black, normal).
 */
export function buildOverlayBlockStyle(textStyle: TextStyle | undefined): string {
	const ts = textStyle;
	const parts: string[] = [
		`font-family:${ts?.fontFamily ?? 'inherit'}`,
		`font-size:${ts?.fontSize !== undefined ? `${ts.fontSize}pt` : '10pt'}`,
		`color:${ts?.color ?? '#000000'}`,
		`font-weight:${ts?.bold ? 'bold' : 'normal'}`,
		`font-style:${ts?.italic ? 'italic' : 'normal'}`,
		`text-decoration:${ts?.underline ? 'underline' : 'none'}`,
		'padding:0 4px',
		'white-space:pre-wrap',
		'line-height:1.2',
		'max-width:100%',
	];
	return parts.join(';');
}

/**
 * Inline style string for a single text-run `<span>`.
 *
 * Run-level properties override paragraph-level properties where both are
 * present. Falls back to `textStyle` (paragraph defaults) for each property.
 */
export function buildSegmentStyle(segment: TextSegment, textStyle: TextStyle | undefined): string {
	const s = segment.style;
	const ts = textStyle;
	const parts: string[] = [
		`font-family:${s?.fontFamily ?? ts?.fontFamily ?? 'inherit'}`,
		`color:${s?.color ?? ts?.color ?? '#000000'}`,
		`font-weight:${s?.bold ? 'bold' : ts?.bold ? 'bold' : 'normal'}`,
		`font-style:${s?.italic ? 'italic' : ts?.italic ? 'italic' : 'normal'}`,
		`text-decoration:${s?.underline ? 'underline' : 'none'}`,
	];
	if (s?.fontSize !== undefined) {
		parts.push(`font-size:${s.fontSize}pt`);
	}
	return parts.join(';');
}

// ---------------------------------------------------------------------------
// Derived segment type (carries the style string so the template loops cleanly)
// ---------------------------------------------------------------------------

/** A `TextSegment` pre-processed with its computed inline style. */
export interface StyledSegment {
	text: string;
	style: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<pptx-connector-text-overlay>` — renders a connector's text label.
 *
 * **Usage** (inside `ConnectorRendererComponent`'s host wrapper `<div>`):
 * ```html
 * @if (hasLabel()) {
 *   <pptx-connector-text-overlay
 *     [text]="element().text"
 *     [segments]="element().textSegments"
 *     [textStyle]="element().textStyle"
 *   />
 * }
 * ```
 *
 * All inputs are optional; the component renders nothing when `text` is falsy
 * or `segments` is empty.
 */
@Component({
	selector: 'pptx-connector-text-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [],
	template: `
		@if (hasText()) {
			<div class="pptx-ng-connector-text" [style]="containerStyle()">
				<div class="pptx-ng-connector-text__block" [style]="blockStyle()">
					@for (seg of styledSegments(); track $index) {
						<span class="pptx-ng-connector-text__run" [style]="seg.style">{{ seg.text }}</span>
					}
				</div>
			</div>
		}
	`,
})
export class ConnectorTextOverlayComponent {
	/**
	 * Trimmed plain-text label. When falsy the overlay is not rendered.
	 * This is the `text` property from `ConnectorPptxElement`.
	 */
	readonly text = input<string | undefined>(undefined);

	/**
	 * Per-run rich-text segments from `ConnectorPptxElement.textSegments`.
	 * When absent or empty the overlay is not rendered.
	 */
	readonly segments = input<ReadonlyArray<TextSegment> | undefined>(undefined);

	/**
	 * Paragraph-level text style from `ConnectorPptxElement.textStyle`.
	 * Controls alignment, default font, colour, etc.
	 */
	readonly textStyle = input<TextStyle | undefined>(undefined);

	// -----------------------------------------------------------------------
	// Derived signals
	// -----------------------------------------------------------------------

	/** True when there is a non-empty label to display. */
	readonly hasText = computed(
		() =>
			Boolean(this.text()) && this.segments() !== undefined && (this.segments()?.length ?? 0) > 0,
	);

	/** Inline style for the outer flex container. */
	readonly containerStyle = computed(() => buildOverlayContainerStyle(this.textStyle()?.align));

	/** Inline style for the inner paragraph block. */
	readonly blockStyle = computed(() => buildOverlayBlockStyle(this.textStyle()));

	/** Pre-computed segments with their individual inline style strings. */
	readonly styledSegments = computed<StyledSegment[]>(() => {
		const segs = this.segments() ?? [];
		const ts = this.textStyle();
		return segs
			.filter((s) => !s.isParagraphBreak)
			.map((s) => ({ text: s.text, style: buildSegmentStyle(s, ts) }));
	});
}
