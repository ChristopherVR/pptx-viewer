<script setup lang="ts">
/**
 * Thin wrapper that renders SmartArtRenderer with inline node editing disabled.
 *
 * Used by SmartArt3DRenderer as an invisible hit-test layer so double-clicks
 * on the 3D canvas can identify which SmartArt node was clicked without the
 * 2D renderer activating its own inline editor and conflicting with the 3D
 * renderer's editor.
 *
 * This provides a disabled SmartArtNodeEditKey injection that overrides any
 * editing context the host tree may have supplied, so SmartArtRenderer sees
 * `editable = false` and never opens its own textarea.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { provide } from 'vue';

import { SmartArtNodeEditKey } from '../composables/smartart-node-edit';
import SmartArtRenderer from './SmartArtRenderer.vue';

defineProps<{
	element: PptxElement;
	zIndex: number;
}>();

// Override the edit context: SmartArtRenderer checks this injection to decide
// whether node groups are editable. Returning false here prevents it from
// opening its own editor while still rendering its SVG for hit-testing.
provide(SmartArtNodeEditKey, {
	canEdit: (): boolean => false,
	commit: (_elementId: string, _nodeId: string, _text: string): void => {},
});
</script>

<template>
	<SmartArtRenderer :element="element" :zIndex="zIndex" />
</template>
