/**
 * ribbon-freeform-tools.component.ts: Insert > Shapes' click-to-place drawing
 * tools (Freeform: Shape, Curve).
 *
 * Selector: `pptx-ribbon-freeform-tools`
 *
 * A press arms the tool (press again to disarm); the drawing itself happens on
 * the canvas overlay (`FreeformToolOverlayComponent`). Hosts can hide either
 * tool through `hiddenDrawingTools`. Renders nothing outside a viewer that
 * provides `OutlineAuthoringService`.
 *
 * Reference binding: packages/react/src/viewer/components/toolbar/FreeformToolButtons.tsx
 *
 * @module viewer/ribbon-freeform-tools
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { FreeformToolKind } from '../internal/shared';
import {
	FREEFORM_TOOL_IDS,
	FREEFORM_TOOL_LABEL_KEYS,
	isDrawingToolVisible,
} from '../internal/shared';
import { OutlineAuthoringService } from './outline-authoring.service';
import { injectResolvedCustomization } from './viewer-customization.service';

@Component({
	selector: 'pptx-ribbon-freeform-tools',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe],
	template: `
		@if (outline) {
			@for (tool of tools(); track tool) {
				<button
					type="button"
					class="pptx-rb-gb gap-1.5"
					[class.is-active]="outline.activeFreeformTool() === tool"
					[attr.aria-pressed]="outline.activeFreeformTool() === tool"
					[attr.data-pptx-drawing-tool]="tool"
					[title]="labelKeys[tool] | translate"
					(click)="toggle(tool)"
				>
					{{ labelKeys[tool] | translate }}
				</button>
			}
		}
	`,
	styles: `
		.is-active {
			background: color-mix(in srgb, currentColor 15%, transparent);
		}
	`,
})
export class RibbonFreeformToolsComponent {
	protected readonly outline = inject(OutlineAuthoringService, { optional: true });
	private readonly customization = injectResolvedCustomization();
	protected readonly labelKeys = FREEFORM_TOOL_LABEL_KEYS;

	/** The tools the host did not hide. */
	protected readonly tools = computed<readonly FreeformToolKind[]>(() =>
		FREEFORM_TOOL_IDS.filter((tool) => isDrawingToolVisible(this.customization(), tool)),
	);

	protected toggle(tool: FreeformToolKind): void {
		const outline = this.outline;
		if (outline) {
			outline.armFreeformTool(outline.activeFreeformTool() === tool ? null : tool);
		}
	}
}
