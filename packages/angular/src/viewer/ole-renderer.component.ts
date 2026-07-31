import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';

import { openUrlInNewTab } from '../internal/shared';
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
 * Double-click-to-open and OLE extraction are not ported (viewer-only).
 */
@Component({
	selector: 'pptx-ole-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, TranslatePipe],
	template: `
		<div class="pptx-ng-ole" role="img" [attr.aria-label]="ariaLabel()" [attr.title]="infoTitle()">
			@if (previewSrc()) {
				<!-- Preview image with type-badge overlay -->
				<div class="pptx-ng-ole-preview">
					<img
						[src]="previewSrc()"
						[attr.alt]="ariaLabel()"
						class="pptx-ng-ole-img"
						draggable="false"
					/>
					<svg class="pptx-ng-ole-badge" width="24" height="24" viewBox="0 0 24 24">
						<rect x="2" y="2" width="20" height="20" rx="3" [attr.fill]="typeColor()" />
						<text
							x="12"
							y="16"
							text-anchor="middle"
							fill="white"
							[attr.font-size]="badgeLabel().length > 4 ? 6 : 10"
							font-weight="bold"
						>
							{{ badgeLabel() }}
						</text>
					</svg>
				</div>
			} @else {
				<!-- Type-specific placeholder box -->
				<div class="pptx-ng-ole-placeholder" [ngStyle]="placeholderStyle()">
					@switch (oleType()) {
						@case ('excel') {
							<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
								<rect
									x="3"
									y="3"
									width="18"
									height="18"
									rx="2"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									fill="none"
								/>
								<line x1="3" y1="9" x2="21" y2="9" [attr.stroke]="typeColor()" stroke-width="1" />
								<line x1="3" y1="15" x2="21" y2="15" [attr.stroke]="typeColor()" stroke-width="1" />
								<line x1="9" y1="3" x2="9" y2="21" [attr.stroke]="typeColor()" stroke-width="1" />
								<line x1="15" y1="3" x2="15" y2="21" [attr.stroke]="typeColor()" stroke-width="1" />
							</svg>
						}
						@case ('word') {
							<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
								<rect
									x="4"
									y="2"
									width="16"
									height="20"
									rx="2"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									fill="none"
								/>
								<line
									x1="7"
									y1="7"
									x2="17"
									y2="7"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									stroke-linecap="round"
								/>
								<line
									x1="7"
									y1="11"
									x2="17"
									y2="11"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									stroke-linecap="round"
								/>
								<line
									x1="7"
									y1="15"
									x2="13"
									y2="15"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									stroke-linecap="round"
								/>
							</svg>
						}
						@case ('pdf') {
							<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
								<rect
									x="4"
									y="2"
									width="16"
									height="20"
									rx="2"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									fill="none"
								/>
								<text
									x="12"
									y="14"
									text-anchor="middle"
									[attr.fill]="typeColor()"
									font-size="7"
									font-weight="bold"
								>
									PDF
								</text>
							</svg>
						}
						@case ('visio') {
							<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
								<rect
									x="8"
									y="2"
									width="8"
									height="5"
									rx="1"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									fill="none"
								/>
								<line
									x1="12"
									y1="7"
									x2="12"
									y2="10"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
								/>
								<line
									x1="6"
									y1="10"
									x2="18"
									y2="10"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
								/>
								<line
									x1="6"
									y1="10"
									x2="6"
									y2="13"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
								/>
								<line
									x1="18"
									y1="10"
									x2="18"
									y2="13"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
								/>
								<rect
									x="2"
									y="13"
									width="8"
									height="5"
									rx="1"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									fill="none"
								/>
								<rect
									x="14"
									y="13"
									width="8"
									height="5"
									rx="1"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									fill="none"
								/>
							</svg>
						}
						@case ('mathtype') {
							<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
								<rect
									x="2"
									y="4"
									width="20"
									height="16"
									rx="2"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									fill="none"
								/>
								<text
									x="12"
									y="15"
									text-anchor="middle"
									[attr.fill]="typeColor()"
									font-size="9"
									font-style="italic"
									font-weight="bold"
								>
									f(x)
								</text>
							</svg>
						}
						@default {
							<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
								<rect
									x="2"
									y="5"
									width="9"
									height="7"
									rx="1.5"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									fill="none"
								/>
								<rect
									x="13"
									y="12"
									width="9"
									height="7"
									rx="1.5"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									fill="none"
								/>
								<line
									x1="11"
									y1="8.5"
									x2="13"
									y2="15.5"
									[attr.stroke]="typeColor()"
									stroke-width="1.5"
									stroke-linecap="round"
								/>
							</svg>
						}
					}
					<span class="pptx-ng-ole-name" [ngStyle]="{ color: typeColor() }">{{
						displayName()
					}}</span>
					@if (fileName()) {
						<span class="pptx-ng-ole-sublabel">{{ typeLabel() }}</span>
					}
				</div>
			}
			@if (actions().canDownload) {
				<!--
					Download / Open actions for the recovered embedded payload.
					Pointer events are isolated so clicking an action never starts a
					selection/drag of the underlying element; the controls are
					keyboard-focusable and only paint on hover / focus-within.
				-->
				<div
					class="pptx-ng-ole-actions"
					(pointerdown)="$event.stopPropagation()"
					(mousedown)="$event.stopPropagation()"
				>
					<a
						class="pptx-ng-ole-action"
						[href]="actions().downloadHref"
						[attr.download]="actions().downloadFileName"
						[attr.aria-label]="
							'pptx.ole.downloadFileAria' | translate: { file: actions().downloadFileName }
						"
						(click)="$event.stopPropagation()"
					>
						{{ 'pptx.ole.download' | translate }}
					</a>
					@if (actions().canOpen) {
						<button
							type="button"
							class="pptx-ng-ole-action"
							[attr.aria-label]="
								'pptx.ole.openFileAria' | translate: { file: actions().downloadFileName }
							"
							(click)="$event.stopPropagation(); openEmbedded()"
						>
							{{ 'pptx.ole.open' | translate }}
						</button>
					}
				</div>
			}
		</div>
	`,
	styles: [
		`
			/*
				This renderer fills the positioned element box its host (the element
				dispatcher) draws; it must NOT position itself. Owning left/top here
				as well offset the OLE box twice, and stamping the element id on this
				root hid the host's marked node from anything reading the element
				contract by id.
			*/
			.pptx-ng-ole {
				position: relative;
				box-sizing: border-box;
				width: 100%;
				height: 100%;
			}
			.pptx-ng-ole-preview {
				position: relative;
				width: 100%;
				height: 100%;
			}
			.pptx-ng-ole-img {
				width: 100%;
				height: 100%;
				object-fit: contain;
				pointer-events: none;
				user-select: none;
				display: block;
			}
			.pptx-ng-ole-badge {
				position: absolute;
				bottom: 4px;
				right: 4px;
				z-index: 10;
			}
			.pptx-ng-ole-placeholder {
				width: 100%;
				height: 100%;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				pointer-events: none;
				box-sizing: border-box;
			}
			.pptx-ng-ole-name {
				margin-top: 8px;
				font-size: 12px;
				font-weight: 500;
				max-width: 90%;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.pptx-ng-ole-sublabel {
				margin-top: 2px;
				font-size: 10px;
				color: rgba(0, 0, 0, 0.45);
				max-width: 90%;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.pptx-ng-ole-actions {
				position: absolute;
				bottom: 4px;
				left: 4px;
				display: flex;
				gap: 4px;
				z-index: 11;
				opacity: 0;
				transition: opacity 0.12s ease-in-out;
			}
			/* Reveal on hover, or whenever a control inside is keyboard-focused. */
			.pptx-ng-ole:hover .pptx-ng-ole-actions,
			.pptx-ng-ole-actions:focus-within {
				opacity: 1;
			}
			.pptx-ng-ole-action {
				font-size: 11px;
				line-height: 1;
				padding: 4px 8px;
				border-radius: 4px;
				background-color: rgba(0, 0, 0, 0.72);
				color: #fff;
				text-decoration: none;
				cursor: pointer;
				white-space: nowrap;
				/* Capture pointer events on the controls only. */
				pointer-events: auto;
			}
			.pptx-ng-ole-action:hover {
				background-color: rgba(0, 0, 0, 0.85);
			}
			.pptx-ng-ole-action:focus-visible {
				outline: 2px solid #fff;
				outline-offset: 1px;
			}
		`,
	],
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
