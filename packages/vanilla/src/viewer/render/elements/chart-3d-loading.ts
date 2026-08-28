import { createEl } from '../dom';
import type { ElementRenderContext } from '../types';

/**
 * Lightweight spinner placeholder shown by every interactive 3D chart
 * renderer (bar3D/line3D/area3D/pie3D/surface) while `three` is loading and
 * the scene is mounting.
 *
 * Standing the already-rendered 2D chart in for this window used to make
 * every 3D chart flash its flat rendering for a moment before the WebGL
 * scene swapped in. Uses the shared `.pptxv-spinner` keyframe animation
 * (`styles/css.ts`), the same one the AI panel and autosave indicators use,
 * so the visual matches the rest of the viewer instead of introducing a
 * second spinner style.
 */
export function createChart3DLoadingPlaceholder(context: ElementRenderContext): HTMLElement {
	const doc = context.document;
	const container = createEl(doc, 'div', 'pptxv-chart3d-loading');
	container.setAttribute('role', 'status');
	container.setAttribute('aria-live', 'polite');

	const spinner = createEl(doc, 'div', 'pptxv-spinner');
	spinner.setAttribute('aria-hidden', 'true');
	container.appendChild(spinner);

	const label = createEl(doc, 'span');
	label.textContent = context.t('pptx.viewer.loading');
	container.appendChild(label);

	return container;
}
