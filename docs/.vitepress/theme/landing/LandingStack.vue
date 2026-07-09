<script setup lang="ts">
import { withBase } from 'vitepress';

import { useLandingCopy } from './copy';

const copy = useLandingCopy();
</script>

<template>
	<section class="pv-section pv-stack">
		<p class="pv-kicker" data-reveal>{{ copy.stack.kicker }}</p>
		<h2 class="pv-h2" data-reveal="2">{{ copy.stack.title }}</h2>
		<p class="pv-copy" data-reveal="3">
			{{ copy.stack.copyPre }}<code>{{ copy.stack.copyCode }}</code
			>{{ copy.stack.copyPost }}
		</p>
		<div class="pv-stack__grid">
			<a
				v-for="(pkg, i) in copy.stack.packages"
				:key="pkg.name"
				class="pv-stack__card"
				:href="pkg.external ? pkg.href : withBase(pkg.href)"
				:data-reveal="String((i % 3) + 1)"
			>
				<code class="pv-stack__install">npm i {{ pkg.name }}</code>
				<p>{{ pkg.desc }}</p>
			</a>
		</div>
	</section>
</template>

<style scoped>
.pv-stack .pv-copy code {
	font-family: var(--pv-mono);
	font-size: 0.86em;
	color: var(--pv-accent);
	background: var(--pv-accent-soft);
	border-radius: 3px;
	padding: 0.15em 0.4em;
}

.pv-stack__grid {
	margin-top: 2.4rem;
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 1rem;
}

.pv-stack__card {
	display: block;
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 8px;
	padding: 1.3rem 1.4rem;
	transition:
		transform 0.35s cubic-bezier(0.25, 0.6, 0.3, 1),
		border-color 0.35s ease,
		box-shadow 0.35s ease;
}

.pv-stack__card:hover {
	transform: translateY(-5px);
	border-color: var(--pv-accent);
	box-shadow: var(--pv-shadow);
}

.pv-stack__install {
	display: block;
	font-family: var(--pv-mono);
	font-size: 0.78rem;
	color: var(--pv-ink);
	background: none;
	margin-bottom: 0.55rem;
}

.pv-stack__install::before {
	content: '$ ';
	color: var(--pv-accent);
}

.pv-stack__card p {
	margin: 0;
	font-size: 0.88rem;
	line-height: 1.6;
	color: var(--pv-ink-soft);
}

@media (max-width: 900px) {
	.pv-stack__grid {
		grid-template-columns: 1fr 1fr;
	}
}

@media (max-width: 560px) {
	.pv-stack__grid {
		grid-template-columns: 1fr;
	}
}
</style>
