<script setup lang="ts">
import { withBase } from 'vitepress';

import { useLandingCopy } from './copy';

const copy = useLandingCopy();
</script>

<template>
	<section class="pv-section pv-bento">
		<p class="pv-kicker" data-reveal>{{ copy.bento.kicker }}</p>
		<div class="pv-bento__grid">
			<a
				v-for="(tile, i) in copy.bento.tiles"
				:key="tile.title"
				class="pv-bento__tile"
				:class="{ 'pv-bento__tile--wide': tile.wide }"
				:href="withBase(tile.href)"
				:data-reveal="String((i % 3) + 1)"
			>
				<h3>{{ tile.title }}</h3>
				<p>{{ tile.copy }}</p>
				<span class="pv-bento__go" aria-hidden="true">&rarr;</span>
			</a>
		</div>
	</section>
</template>

<style scoped>
.pv-bento__grid {
	margin-top: 2.4rem;
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 1rem;
}

.pv-bento__tile {
	position: relative;
	display: block;
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 8px;
	padding: 1.5rem 1.5rem 2.6rem;
	transition:
		transform 0.35s cubic-bezier(0.25, 0.6, 0.3, 1),
		border-color 0.35s ease,
		box-shadow 0.35s ease;
}

.pv-bento__tile--wide {
	grid-column: 1 / -1;
}

.pv-bento__tile:hover {
	transform: translateY(-5px);
	border-color: var(--pv-accent);
	box-shadow: var(--pv-shadow);
}

.pv-bento__tile h3 {
	font-family: var(--pv-display);
	font-size: 1.08rem;
	font-weight: 640;
	letter-spacing: -0.01em;
	margin: 0 0 0.6rem;
}

.pv-bento__tile p {
	font-size: 0.9rem;
	line-height: 1.65;
	color: var(--pv-ink-soft);
	margin: 0;
	max-width: 72ch;
}

.pv-bento__go {
	position: absolute;
	right: 1.3rem;
	bottom: 1rem;
	color: var(--pv-accent);
	transition: transform 0.3s ease;
}

.pv-bento__tile:hover .pv-bento__go {
	transform: translateX(5px);
}

@media (max-width: 900px) {
	.pv-bento__grid {
		grid-template-columns: 1fr 1fr;
	}
}

@media (max-width: 560px) {
	.pv-bento__grid {
		grid-template-columns: 1fr;
	}
}
</style>
