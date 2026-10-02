import { attachRibbonOverflow } from 'pptx-viewer-shared';
import type { RibbonLaunchers } from 'pptx-viewer-shared';

/**
 * Svelte action: collapse the ribbon row's groups into popup buttons when the window is too
 * narrow, as Office does, and add the corner launchers `launchers` names. The shared controller
 * only toggles attributes on the groups.
 */
export function ribbonOverflow(node: HTMLElement, launchers: RibbonLaunchers) {
	const detach = attachRibbonOverflow(node, { launchers });
	return { destroy: detach };
}
