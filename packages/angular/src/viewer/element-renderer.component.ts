import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { ConnectorRendererComponent } from './connector-renderer.component';
import {
	getContainerStyle,
	getImageSrc,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
} from './element-style';
import type { StyleMap } from './element-style';
import { TableRendererComponent } from './table-renderer.component';

interface TextRun {
	text: string;
	style: StyleMap;
}

/**
 * ElementRendererComponent — Angular port of the React `ElementRenderer.tsx`
 * and the Vue `ElementRenderer.vue`.
 *
 * Renders a single slide element by its `type` discriminant (viewer-first
 * subset):
 *  - `text` / `shape`    → positioned box with fill/stroke + rich text
 *  - `picture` / `image` → `<img>`
 *  - `media`             → poster frame (`<img>`) — playback TODO
 *  - `group`             → recursive children (self-referencing selector)
 *  - everything else     → labelled placeholder (TODO, see PORTING.md)
 *
 * Interaction (selection, resize, inline editing), connectors, charts, tables,
 * SmartArt, ink, OLE, and 3D are not yet ported.
 */
@Component({
	selector: 'pptx-element-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, ConnectorRendererComponent, TableRendererComponent],
	template: `
		@switch (true) {
			@case (element().type === 'connector') {
				<pptx-connector-renderer [element]="element()" [zIndex]="zIndex()" />
			}
			@case (element().type === 'table') {
				<div
					class="pptx-ng-element pptx-ng-table"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
				>
					<pptx-table-renderer [element]="element()" />
				</div>
			}
			@case (element().type === 'group') {
				<div
					class="pptx-ng-element pptx-ng-group"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
				>
					@for (child of children(); track child.id) {
						<pptx-element-renderer
							[element]="child"
							[mediaDataUrls]="mediaDataUrls()"
							[zIndex]="$index"
						/>
					}
				</div>
			}
			@case (isImageLike()) {
				<div
					class="pptx-ng-element pptx-ng-image"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
				>
					@if (imageSrc()) {
						<img [src]="imageSrc()" alt="" class="pptx-ng-img" />
					}
				</div>
			}
			@case (element().type === 'media') {
				<div
					class="pptx-ng-element pptx-ng-media"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
				>
					@if (imageSrc()) {
						<img [src]="imageSrc()" alt="" class="pptx-ng-img" />
					} @else {
						<div class="pptx-ng-placeholder">{{ placeholderLabel() }}</div>
					}
				</div>
			}
			@case (isShapeLike()) {
				<div
					class="pptx-ng-element pptx-ng-shape"
					[ngStyle]="shapeContainerStyle()"
					[attr.data-element-id]="element().id"
				>
					@if (hasText()) {
						<div class="pptx-ng-text" [ngStyle]="textStyle()">
							@for (para of paragraphs(); track $index) {
								<p class="pptx-ng-para">
									@for (run of para; track $index) {
										@if (
											run.text ===
											'
'
										) {
											<br />
										} @else {
											<span [ngStyle]="run.style">{{ run.text }}</span>
										}
									}
								</p>
							}
						</div>
					}
				</div>
			}
			@default {
				<div
					class="pptx-ng-element pptx-ng-unsupported"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
				>
					<div class="pptx-ng-placeholder">{{ placeholderLabel() }}</div>
				</div>
			}
		}
	`,
})
export class ElementRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly zIndex = input<number>(0);

	readonly containerStyle = computed<StyleMap>(() =>
		getContainerStyle(this.element(), this.zIndex()),
	);
	readonly shapeContainerStyle = computed<StyleMap>(() => ({
		...this.containerStyle(),
		...getShapeFillStrokeStyle(this.element()),
	}));
	readonly textStyle = computed<StyleMap>(() => getTextBlockStyle(this.element()));
	readonly imageSrc = computed(() => getImageSrc(this.element(), this.mediaDataUrls()));

	readonly children = computed<PptxElement[]>(() => {
		const el = this.element();
		return el.type === 'group' ? (el.children ?? []) : [];
	});

	readonly isShapeLike = computed(
		() => this.element().type === 'text' || this.element().type === 'shape',
	);
	readonly isImageLike = computed(
		() => this.element().type === 'picture' || this.element().type === 'image',
	);

	readonly paragraphs = computed<TextRun[][]>(() => {
		const el = this.element();
		if (!hasTextProperties(el)) {
			return [];
		}
		const segments = el.textSegments;
		if (!segments || segments.length === 0) {
			return el.text ? [[{ text: el.text, style: {} }]] : [];
		}
		const out: TextRun[][] = [[]];
		for (const seg of segments) {
			if (seg.isParagraphBreak) {
				out.push([]);
				continue;
			}
			const current = out[out.length - 1];
			const text = seg.isLineBreak ? '\n' : seg.text;
			if (text) {
				current.push({ text, style: this.segmentStyle(seg) });
			}
		}
		return out.filter((p) => p.length > 0 || out.length === 1);
	});

	readonly hasText = computed(() => this.paragraphs().some((p) => p.length > 0));

	readonly placeholderLabel = computed(() => {
		const map: Record<string, string> = {
			chart: 'Chart',
			smartArt: 'SmartArt',
			group: 'Group',
			media: 'Media',
			ink: 'Ink',
			ole: 'Embedded object',
			model3d: '3D model',
			zoom: 'Zoom',
		};
		return map[this.element().type] ?? this.element().type;
	});

	private segmentStyle(seg: TextSegment): StyleMap {
		const s = seg.style ?? {};
		const style: StyleMap = {};
		if (s.fontFamily) {
			style['font-family'] = s.fontFamily;
		}
		if (typeof s.fontSize === 'number') {
			style['font-size'] = `${s.fontSize}pt`;
		}
		if (s.color) {
			style['color'] = s.color;
		}
		if (s.bold) {
			style['font-weight'] = 'bold';
		}
		if (s.italic) {
			style['font-style'] = 'italic';
		}
		const deco: string[] = [];
		if (s.underline) {
			deco.push('underline');
		}
		if (s.strikethrough) {
			deco.push('line-through');
		}
		if (deco.length > 0) {
			style['text-decoration'] = deco.join(' ');
		}
		return style;
	}
}
