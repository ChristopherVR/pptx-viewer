/**
 * XML node builder functions for the OOXML animation write service.
 *
 * This module is a barrel: the actual builders live in sibling
 * `animation-write-node-*` modules, split by node family (keyframes,
 * behaviors, single-effect assembly, motion path) to keep each file under
 * the repo's 300-LOC limit. Every symbol below is re-exported unchanged so
 * existing imports of `./animation-write-node-builders` keep working.
 */
export { applyAfterAnimationBehavior } from './animation-after-effect-write';

export { buildTavLstFromKeyframes } from './animation-write-node-keyframes';

export {
	applySoundToEffectCTn,
	buildVisibilitySet,
	buildAnimEffectNode,
} from './animation-write-node-behaviors';

export { buildSingleEffectNode } from './animation-write-node-effect';

export { buildMotionPathNode } from './animation-write-node-motion';
