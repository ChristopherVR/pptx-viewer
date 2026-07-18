<script setup lang="ts">
import { withBase } from 'vitepress';

import CodeCard from './code/CodeCard.vue';
import { HEADLESS_SAMPLE, MCP_CONFIG_SAMPLE } from './code/samples';
import { useLandingCopy } from './copy';

const copy = useLandingCopy();
</script>

<template>
	<section class="pv-section pv-agents">
		<div class="pv-agents__grid">
			<div class="pv-agents__copy">
				<p class="pv-kicker" data-reveal>{{ copy.agents.kicker }}</p>
				<h2 class="pv-h2" data-reveal="2">{{ copy.agents.title }}</h2>
				<p class="pv-copy" data-reveal="3">{{ copy.agents.copy }}</p>
				<a class="pv-link" :href="withBase(copy.agents.link.href)" data-reveal="3">
					{{ copy.agents.link.text }} <i>&rarr;</i>
				</a>
			</div>
			<div class="pv-agents__code" data-reveal="3">
				<CodeCard
					file=".mcp.json"
					badge="Claude &middot; Cursor &middot; Copilot"
					:code="MCP_CONFIG_SAMPLE"
				/>
				<CodeCard
					file="round-trip.ts"
					badge="Node &middot; Bun &middot; browser"
					:code="HEADLESS_SAMPLE"
				/>
			</div>
		</div>
	</section>
</template>

<style scoped>
.pv-agents__grid {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
	gap: clamp(2rem, 5vw, 5rem);
	align-items: center;
}

.pv-agents__code {
	display: flex;
	flex-direction: column;
	gap: 1.2rem;
}

@media (max-width: 900px) {
	.pv-agents__grid {
		grid-template-columns: 1fr;
	}
}
</style>
