/**
 * ribbon-insert-freeform.ts: Insert > Shapes' click-to-place drawing tools
 * (Freeform: Shape, Curve), as pure helpers behind the shared Insert element.
 *
 * The shared `pptx-ui-ribbon-insert` renders the buttons and pressed state; arming
 * stays native because the drawing happens on the canvas overlay
 * (`FreeformToolOverlayComponent`) and the arm state lives in
 * {@link OutlineAuthoringService}. Hosts can hide either tool through
 * `hiddenDrawingTools`; nothing renders outside a viewer that provides the service.
 */
import { FREEFORM_TOOL_IDS, isDrawingToolVisible } from '../internal/shared';
import type { FreeformToolKind, ResolvedCustomization } from '../internal/shared';
import type { OutlineAuthoringService } from './outline-authoring.service';

/** The tools the host did not hide, or none without an outline-authoring service. */
export function visibleFreeformTools(
	outline: OutlineAuthoringService | null,
	customization: ResolvedCustomization,
): readonly FreeformToolKind[] {
	return outline
		? FREEFORM_TOOL_IDS.filter((tool) => isDrawingToolVisible(customization, tool))
		: [];
}
