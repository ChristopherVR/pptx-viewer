<script setup lang="ts">
import { ref } from 'vue';

import { useLandingCopy } from '../copy';
import { FRAMEWORKS } from './samples';

const copy = useLandingCopy();
const active = ref(FRAMEWORKS[0]);
const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

function select(id: string): void {
	active.value = FRAMEWORKS.find((f) => f.id === id) ?? FRAMEWORKS[0];
}

async function copyCommand(): Promise<void> {
	try {
		await navigator.clipboard.writeText(active.value.install);
		copied.value = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied.value = false), 1600);
	} catch {
		/* clipboard unavailable (http, permissions); the command is still visible */
	}
}
</script>

<template>
	<div class="pv-install">
		<div class="pv-install__tabs" role="tablist">
			<button
				v-for="fw in FRAMEWORKS"
				:key="fw.id"
				type="button"
				role="tab"
				:aria-selected="fw.id === active.id"
				:class="['pv-install__tab', { 'is-active': fw.id === active.id }]"
				@click="select(fw.id)"
			>
				{{ fw.label }}
			</button>
		</div>
		<div class="pv-install__row">
			<code class="pv-install__cmd">{{ active.install }}</code>
			<button type="button" class="pv-install__copy" @click="copyCommand">
				{{ copied ? copy.hero.copiedLabel : copy.hero.copyLabel }}
			</button>
		</div>
	</div>
</template>

<style scoped>
.pv-install {
	margin-top: 1.8rem;
	max-width: 33rem;
}

.pv-install__tabs {
	display: flex;
	flex-wrap: wrap;
	gap: 0.35rem;
}

.pv-install__tab {
	font-family: var(--pv-mono);
	font-size: 0.68rem;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: var(--pv-ink-soft);
	background: none;
	border: 1px solid transparent;
	border-bottom: none;
	border-radius: 3px 3px 0 0;
	padding: 0.45em 0.85em;
	cursor: pointer;
	transition:
		color 0.2s ease,
		background-color 0.2s ease;
}

.pv-install__tab:hover {
	color: var(--pv-ink);
}

.pv-install__tab.is-active {
	color: var(--pv-accent);
	background: var(--pv-surface);
	border-color: var(--pv-line);
	position: relative;
	z-index: 1;
	margin-bottom: -1px;
}

.pv-install__row {
	display: flex;
	align-items: stretch;
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 0 3px 3px 3px;
}

.pv-install__cmd {
	flex: 1;
	font-family: var(--pv-mono);
	font-size: 0.8rem;
	color: var(--pv-ink-soft);
	padding: 0.65em 1em;
	overflow-x: auto;
	white-space: nowrap;
}

.pv-install__cmd::before {
	content: '$ ';
	color: var(--pv-accent);
}

.pv-install__copy {
	font-family: var(--pv-mono);
	font-size: 0.66rem;
	letter-spacing: 0.16em;
	text-transform: uppercase;
	color: var(--pv-accent);
	background: none;
	border: none;
	border-left: 1px solid var(--pv-line);
	padding: 0 1.1em;
	cursor: pointer;
	white-space: nowrap;
}

.pv-install__copy:hover {
	color: var(--pv-accent-deep);
}
</style>
