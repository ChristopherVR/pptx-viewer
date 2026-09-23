/**
 * `<pptx-three-view>` scene module for 3D charts.
 *
 * PLACEHOLDER: the chart-engine track implements the PowerPoint-parity 3D
 * chart scene here. Until then mounting rejects, so the element keeps
 * showing its slotted 2D fallback.
 *
 * @module chart-3d-view-scene
 */
import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import type { Chart3DSpec } from './chart-3d-spec';

export async function mountChart3DView(
	_spec: Chart3DSpec,
	_ctx: ThreeViewContext,
): Promise<ThreeViewScene> {
	throw new Error('3D chart scene not implemented yet');
}
