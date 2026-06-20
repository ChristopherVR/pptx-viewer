/**
 * collaboration-cursors.component.ts: Angular port of the Vue
 * `CollaborationCursors.vue` presentational overlay.
 *
 * Selector: `pptx-collaboration-cursors`
 *
 * Renders remote collaborators' cursors above the slide stage. This component
 * is purely visual: it owns no network/Yjs logic. The host supplies a reactive
 * list of {@link RemoteCursor} entries (from `CollaborationService.cursors`)
 * plus the current `zoom`; each entry is drawn as an absolutely-positioned
 * pointer SVG plus a name-label chip in the user's colour, placed at
 * `(x * zoom, y * zoom)`.
 *
 * `x`/`y` are *unscaled* slide coordinates (px); this component multiplies by
 * `zoom` so it can be mounted inside the scaled slide-stage host while still
 * receiving raw slide-space coordinates.
 *
 * The overlay sets `pointer-events: none` so it never intercepts canvas input.
 *
 * Inputs:
 *   - `cursors`: remote collaborators to render (unscaled slide coords)
 *   - `zoom`: current canvas zoom factor (default: 1)
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MAX_LABEL_CHARS, formatCursorLabel } from './collaboration-helpers';
import type { RemoteCursor } from './collaboration-helpers';

/** A positioned cursor view-model used by the template. */
interface PositionedCursor {
	clientId: number | string;
	color: string;
	label: string;
	transform: string;
}

@Component({
	selector: 'pptx-collaboration-cursors',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			position: absolute;
			inset: 0;
			pointer-events: none;
			overflow: visible;
			z-index: 9999;
		}

		.pptx-ng-collab-cursor {
			position: absolute;
			top: 0;
			left: 0;
			pointer-events: none;
			will-change: transform;
			transition: transform 90ms linear;
		}

		.pptx-ng-collab-pointer {
			display: block;
			filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
		}

		.pptx-ng-collab-label {
			position: absolute;
			top: 16px;
			left: 12px;
			max-width: 150px;
			padding: 2px 6px;
			border-radius: 4px;
			color: #ffffff;
			font-family: system-ui, sans-serif;
			font-size: 10px;
			font-weight: 500;
			line-height: 1.2;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		}
	`,
	template: `
		<div class="pptx-ng-collab-cursors" aria-hidden="true" data-export-ignore="true">
			@for (cursor of positioned(); track cursor.clientId) {
				<div
					class="pptx-ng-collab-cursor"
					[attr.data-client-id]="cursor.clientId"
					[style.transform]="cursor.transform"
				>
					<svg
						class="pptx-ng-collab-pointer"
						width="20"
						height="22"
						viewBox="0 0 20 22"
						focusable="false"
					>
						<path
							d="M0 0 L0 16 L4.5 12.5 L8 20 L10.5 19 L7 11.5 L12 11 Z"
							[attr.fill]="cursor.color"
							stroke="#ffffff"
							stroke-width="1"
						/>
					</svg>
					<span class="pptx-ng-collab-label" [style.background-color]="cursor.color">
						{{ cursor.label }}
					</span>
				</div>
			}
		</div>
	`,
})
export class CollaborationCursorsComponent {
	/** Remote collaborators to render, in unscaled slide coordinates. */
	readonly cursors = input<RemoteCursor[]>([]);
	/** Current canvas zoom factor; cursor positions scale by this. */
	readonly zoom = input<number>(1);

	/** Precompute positions + labels so the template stays declarative. */
	protected readonly positioned = computed<PositionedCursor[]>(() => {
		const z = this.zoom();
		return this.cursors().map((cursor) => ({
			clientId: cursor.clientId,
			color: cursor.color,
			label: formatCursorLabel(cursor.userName, MAX_LABEL_CHARS),
			transform: `translate(${cursor.x * z}px, ${cursor.y * z}px)`,
		}));
	});
}
