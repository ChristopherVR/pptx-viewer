import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { PptxElement, PptxTableData } from 'pptx-viewer-core';

import type { ElementAnimationState } from '../internal/shared';
import { ChartElementViewComponent } from './chart-element-view.component';
import { ContentPartRendererComponent } from './content-part-renderer.component';
import { DynamicStyleComponent } from './dynamic-style.component';
import type { StyleMap } from './element-style';
import { InkRendererComponent } from './ink-renderer.component';
import { MediaRendererComponent } from './media-renderer.component';
import { Model3DRendererComponent } from './model3d-renderer.component';
import { OleRendererComponent } from './ole-renderer.component';
import { SmartArt3DRendererComponent } from './smart-art-3d-renderer.component';
import { SmartArtRendererComponent } from './smart-art-renderer.component';
import { TableRendererComponent } from './table-renderer.component';
import type { TableCellCommit } from './table-renderer.component';
import { ZoomRendererComponent } from './zoom-renderer.component';

/**
 * The "simple wrapper" element kinds of `ElementRendererComponent`: each of
 * these paints a single specialised renderer (optionally inside a marked
 * `containerStyle` box), unlike the `text`/`shape` branch (own component,
 * `ElementRendererShapeComponent`) or `group`/`connector`, which stay on the
 * parent because they recurse or need routing obstacles.
 *
 * Split out purely to keep `ElementRendererComponent`'s `.ts`/`.html` under
 * the file-size limit; every input here is a value the parent already
 * computes for its own dispatch, threaded straight through.
 */
@Component({
	selector: 'pptx-element-renderer-graphics',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		NgStyle,
		DynamicStyleComponent,
		InkRendererComponent,
		ContentPartRendererComponent,
		ZoomRendererComponent,
		Model3DRendererComponent,
		SmartArt3DRendererComponent,
		SmartArtRendererComponent,
		OleRendererComponent,
		ChartElementViewComponent,
		TableRendererComponent,
		MediaRendererComponent,
	],
	templateUrl: './element-renderer-graphics.component.html',
})
export class ElementRendererGraphicsComponent {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly interactive = input<boolean>(true);
	readonly editable = input<boolean>(false);
	readonly presenting = input<boolean>(false);
	readonly exposeElementId = input<boolean>(true);
	/** Whether this element's root carries `data-pptx-element="true"`. */
	readonly elementMarked = input<boolean>(false);
	/** `data-element-id` for this element, or null on a miniature surface. */
	readonly elementIdAttr = input<string | null>(null);
	readonly rootPointerEvents = input<'none' | null>(null);
	readonly containerStyle = input<StyleMap>({});
	readonly textStyleOverrideCss = input<string | undefined>(undefined);
	readonly animationState = input<ElementAnimationState | undefined>(undefined);
	/** Whether the host opted into the Three.js SmartArt renderer. */
	readonly smartArt3D = input<boolean>(false);
	readonly placeholderLabel = input<string>('');

	/** Emitted when a table cell's text edit is committed. */
	readonly cellCommit = output<{ id: string; commit: TableCellCommit }>();

	/** Emitted when a structural table change (drag-resize) should be persisted. */
	readonly tableChange = output<{ id: string; tableData: PptxTableData }>();
}
