import type { FreeformToolKind } from 'pptx-viewer-shared';
import { FREEFORM_TOOL_LABEL_KEYS } from 'pptx-viewer-shared';

import type { Translator } from '../../../../i18n';
import type { ButtonHandle } from '../../../controls';
import { makeButton } from '../../../controls';
import type { IconName } from '../../../icons';

const ICONS: Record<FreeformToolKind, IconName> = {
	freeformShape: 'pen',
	curve: 'shapes',
};

export interface FreeformToolButtons {
	/** The buttons, in order (empty when the host hid both tools). */
	buttons: HTMLButtonElement[];
	/** Reflect the armed tool (aria-pressed / is-active). */
	setActive(tool: FreeformToolKind | null): void;
	setDisabled(disabled: boolean): void;
}

/**
 * Insert > Shapes' click-to-place drawing tools (Freeform: Shape, Curve). A
 * press arms the tool (press again to disarm); the drawing itself happens on
 * the canvas overlay (`editor/freeform-tool-overlay.ts`).
 */
export function createFreeformToolButtons(
	doc: Document,
	t: Translator,
	tools: readonly FreeformToolKind[],
	onArm: (tool: FreeformToolKind | null) => void,
): FreeformToolButtons {
	let active: FreeformToolKind | null = null;
	const handles: Array<{ tool: FreeformToolKind; handle: ButtonHandle }> = tools.map((tool) => {
		const label = t(FREEFORM_TOOL_LABEL_KEYS[tool]);
		const handle = makeButton(doc, {
			label,
			icon: ICONS[tool],
			textLabel: label,
			onClick: () => onArm(active === tool ? null : tool),
		});
		handle.btn.dataset.pptxDrawingTool = tool;
		handle.setActive(false);
		return { tool, handle };
	});
	return {
		buttons: handles.map(({ handle }) => handle.btn),
		setActive(tool) {
			active = tool;
			for (const { tool: id, handle } of handles) {
				handle.setActive(id === tool);
			}
		},
		setDisabled(disabled) {
			for (const { handle } of handles) {
				handle.setDisabled(disabled);
			}
		},
	};
}
