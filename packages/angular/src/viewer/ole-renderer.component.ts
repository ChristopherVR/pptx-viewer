import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';

import { getOleIconShapes, openUrlInNewTab } from '../internal/shared';
import type { OleIconShape } from '../internal/shared';
import type { StyleMap } from './element-style';
import {
	buildOleActionModel,
	getOleAriaLabel,
	getOleBadgeLabel,
	getOleDisplayName,
	getOleTypeColor,
	getOleTypeLabel,
	getPlaceholderStyle,
	resolveOleType,
} from './ole-renderer-helpers';
import type { OleActionModel, ResolvedOleType } from './ole-renderer-helpers';

/**
 * OleRendererComponent: Angular port of the React `renderOleElement`
 * (packages/react/src/viewer/components/elements/InkGroupRenderers.tsx) and
 * the Vue `OleRenderer.vue`.
 *
 * Renders an embedded OLE object (`OlePptxElement`). When a decoded preview
 * image is present (`previewImageData`) it is shown full-size with a small
 * type-badge overlay; otherwise a type-specific icon + label placeholder box
 * is drawn, mirroring the React / Vue fallback.
 *
 * Positioning is NOT this component's job: it fills the positioned, element-id
 * bearing box its host draws (see `element-renderer.component.ts`), the same
 * contract the chart and table renderers follow.
 *
 * Pure helpers (type resolution, colour / label maps, placeholder style) live
 * in `ole-renderer-helpers.ts` so they can be unit-tested without TestBed.
 *
 * Editing the embedded object in place is not possible (a browser cannot run
 * the native app that owns it); the action bar offers Download and, for
 * browser-openable types, Open in a new tab, when core extracted an embedded
 * payload. The object's Object Name (`oleName`) IS editable, via
 * `pptx-element-misc-properties` in the inspector; `displayName` / `ariaLabel`
 * below already read it through the shared `getOleDisplayName` /
 * `getOleAriaLabel` helpers.
 */
@Component({
	selector: 'pptx-ole-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, TranslatePipe],
	templateUrl: './ole-renderer.component.html',
	styleUrl: './ole-renderer.component.css',
})
export class OleRendererComponent {
	/** The element to render. Must be `type === 'ole'`. */
	readonly element = input.required<PptxElement>();

	/** Narrowed OLE element: undefined when the input is not `type === 'ole'`. */
	private readonly ole = computed<OlePptxElement | undefined>(() => {
		const el = this.element();
		return el.type === 'ole' ? el : undefined;
	});

	/** Resolved application type (excel / word / pdf / visio / mathtype / unknown). */
	readonly oleType = computed<ResolvedOleType>(() => {
		const el = this.ole();
		return el ? resolveOleType(el) : 'unknown';
	});

	/** Brand hex colour for the resolved type. */
	readonly typeColor = computed<string>(() => getOleTypeColor(this.oleType()));

	/** Human-readable type label (e.g. "Excel Spreadsheet"). */
	readonly typeLabel = computed<string>(() => getOleTypeLabel(this.oleType()));

	/** Short uppercase badge text shown over the preview image. */
	readonly badgeLabel = computed<string>(() => getOleBadgeLabel(this.oleType()));

	/** Preview image data-URL, or undefined to show the placeholder. */
	readonly previewSrc = computed<string | undefined>(() => this.ole()?.previewImageData);

	/** Original file name, if present. */
	readonly fileName = computed<string | undefined>(() => this.ole()?.fileName);

	/** Primary display name: file name if present, otherwise the type label. */
	readonly displayName = computed<string>(() => {
		const el = this.ole();
		return el ? getOleDisplayName(el) : getOleTypeLabel('unknown');
	});

	/** Accessible label for the role="img" wrapper. */
	readonly ariaLabel = computed<string>(() => {
		const el = this.ole();
		return el ? getOleAriaLabel(el) : getOleTypeLabel('unknown');
	});

	/** Border + background style for the placeholder box. */
	readonly placeholderStyle = computed<StyleMap>(() => getPlaceholderStyle(this.oleType()));

	/**
	 * Data-driven `rect`/`line`/`text` primitives for the placeholder icon,
	 * shared with every other binding's OLE renderer so the icon glyphs
	 * (Excel grid, Word lines, PDF box, Visio diagram, MathType `f(x)`,
	 * generic linked-object) cannot drift apart. The template maps each
	 * primitive onto its own SVG element.
	 */
	readonly iconShapes = computed<OleIconShape[]>(() => getOleIconShapes(this.oleType()));

	/**
	 * Download / Open action model derived from the recovered embedded payload.
	 * When the input is not an OLE element, every action is disabled.
	 */
	readonly actions = computed<OleActionModel>(() => {
		const el = this.ole();
		if (!el) {
			return {
				canDownload: false,
				canOpen: false,
				downloadHref: undefined,
				downloadFileName: 'embedded-object',
				sizeLabel: undefined,
				info: [],
			};
		}
		return buildOleActionModel(el);
	});

	/**
	 * Descriptive tooltip for the wrapper: the info rows joined as
	 * "Label: value" pairs (e.g. "Type: Excel Spreadsheet, File: budget.xlsx,
	 * Size: 2.3 KB, Application: Excel.Sheet.12"). Falls back to the aria label
	 * when no rows are available.
	 */
	readonly infoTitle = computed<string>(() => {
		const rows = this.actions().info;
		if (rows.length === 0) {
			return this.ariaLabel();
		}
		return rows.map((row) => `${row.label}: ${row.value}`).join(', ');
	});

	/**
	 * Open the recovered embedded payload in a new browser tab. Routes through
	 * the shared {@link openUrlInNewTab} helper, which converts the `data:` URL to
	 * a Blob object URL first: browsers silently refuse to navigate a new
	 * top-level tab straight to a `data:` URL.
	 */
	openEmbedded(): void {
		const href = this.actions().downloadHref;
		if (href) {
			openUrlInNewTab(href);
		}
	}
}
