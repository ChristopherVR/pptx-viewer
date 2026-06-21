/**
 * `pptx-viewer-shared/smartart-3d` - vanilla three.js SmartArt scene runtime.
 *
 * Lazily imported by each binding's SmartArt 3D wrapper so `three` stays an
 * optional dependency: when it is not installed the dynamic import rejects and
 * the binding falls back to the SVG `SmartArtRenderer`. The pure model builder
 * (`buildSmartArt3DModel`) and its types live in the main barrel
 * (`pptx-viewer-shared`) and should be imported from there directly.
 */

export { mountSmartArt3D } from './scene';
export type { SmartArt3DHandle, SmartArt3DViewOptions } from './scene';
export type {
	SmartArt3DModel,
	SmartArt3DModelOptions,
	SmartArt3DMesh,
	SmartArt3DConnector,
} from '../render/smartart-3d-types';
