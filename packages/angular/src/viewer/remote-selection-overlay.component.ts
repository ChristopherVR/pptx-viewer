/**
 * remote-selection-overlay.component.ts: Angular port of the Vue
 * `RemoteSelectionOverlay.vue` / React `RemoteSelectionOverlay.tsx`.
 *
 * Selector: `pptx-remote-selection-overlay`
 *
 * Draws a coloured rectangle around each element a remote collaborator has
 * selected, labelled with that peer's name in their colour (Google-Slides-style
 * presence). Purely presentational: the host supplies the reactive presence
 * list (from `CollaborationService.presence`), the elements on the active slide,
 * the active slide index, and the current `zoom`. Only peers whose
 * `activeSlideIndex` matches are drawn, and only for a selected id that resolves
 * to an element on the slide.
 *
 * Element geometry is in unscaled slide coordinates (px); this component
 * multiplies by `zoom` so it can mount inside the scaled slide stage. It sets
 * `pointer-events: none` so it never intercepts canvas input.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import { MAX_LABEL_CHARS, formatCursorLabel } from './collaboration-helpers';
import type { RemotePresence } from './collaboration-helpers';

/** A single resolved remote selection box, scaled into host pixel space. */
interface RemoteSelectionBox {
	key: string;
	label: string;
	color: string;
	transform: string;
	width: number;
	height: number;
}

@Component({
	selector: 'pptx-remote-selection-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			position: absolute;
			inset: 0;
			pointer-events: none;
			overflow: visible;
			z-index: 9997;
		}

		.pptx-ng-remote-selection {
			position: absolute;
			top: 0;
			left: 0;
			box-sizing: border-box;
			border: 2px solid currentcolor;
			border-radius: 2px;
			pointer-events: none;
			will-change: transform;
			transition: transform 90ms linear;
		}

		.pptx-ng-remote-selection-label {
			position: absolute;
			top: -18px;
			left: -2px;
			max-width: 150px;
			padding: 1px 5px;
			border-radius: 3px;
			color: #ffffff;
			font-family: system-ui, sans-serif;
			font-size: 9px;
			font-weight: 500;
			line-height: 1.3;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	`,
	template: `
		<div aria-hidden="true" data-export-ignore="true">
			@for (box of boxes(); track box.key) {
				<div
					class="pptx-ng-remote-selection"
					[attr.data-element-id]="box.key"
					[style.transform]="box.transform"
					[style.width.px]="box.width"
					[style.height.px]="box.height"
					[style.color]="box.color"
				>
					<span class="pptx-ng-remote-selection-label" [style.background-color]="box.color">
						{{ box.label }}
					</span>
				</div>
			}
		</div>
	`,
})
export class RemoteSelectionOverlayComponent {
	/** Remote collaborators' presence (cursor + selection + active slide). */
	readonly presences = input<RemotePresence[]>([]);
	/** Elements on the active slide (used to resolve selected ids -> geometry). */
	readonly elements = input<readonly PptxElement[]>([]);
	/** The current slide index: only peers on this slide are drawn. */
	readonly activeSlideIndex = input<number>(0);
	/** Current canvas zoom factor; geometry scales by this. */
	readonly zoom = input<number>(1);

	private readonly elementMap = computed(() => {
		const map = new Map<string, PptxElement>();
		for (const el of this.elements()) {
			map.set(el.id, el);
		}
		return map;
	});

	protected readonly boxes = computed<RemoteSelectionBox[]>(() => {
		const slide = this.activeSlideIndex();
		const z = this.zoom();
		const lookup = this.elementMap();
		const result: RemoteSelectionBox[] = [];
		for (const peer of this.presences()) {
			if (peer.activeSlideIndex !== slide || !peer.selectedElementId) {
				continue;
			}
			const el = lookup.get(peer.selectedElementId);
			if (!el) {
				continue;
			}
			result.push({
				key: `${peer.clientId}-${peer.selectedElementId}`,
				label: formatCursorLabel(peer.userName, MAX_LABEL_CHARS),
				color: peer.userColor,
				transform: `translate(${el.x * z}px, ${el.y * z}px)`,
				width: el.width * z,
				height: el.height * z,
			});
		}
		return result;
	});
}
