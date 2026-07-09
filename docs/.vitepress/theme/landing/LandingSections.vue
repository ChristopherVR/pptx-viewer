<script setup lang="ts">
import { withBase } from 'vitepress';

import { useLandingCopy } from './copy';
import FeaturePanel from './FeaturePanel.vue';
import VisualCode from './visuals/VisualCode.vue';
import VisualEditor from './visuals/VisualEditor.vue';
import VisualFrameworks from './visuals/VisualFrameworks.vue';
import VisualMcp from './visuals/VisualMcp.vue';

const visuals = [VisualEditor, VisualCode, VisualFrameworks, VisualMcp];
const copy = useLandingCopy();
</script>

<template>
	<FeaturePanel
		v-for="(panel, i) in copy.panels"
		:key="panel.title"
		:kicker="panel.kicker"
		:title="panel.title"
		:link-href="withBase(panel.link.href)"
		:link-text="panel.link.text"
		:flip="i % 2 === 1"
	>
		<p>{{ panel.copy }}</p>
		<template #visual><component :is="visuals[i]" /></template>
	</FeaturePanel>
</template>
