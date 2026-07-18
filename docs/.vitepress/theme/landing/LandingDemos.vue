<script setup lang="ts">
import { withBase } from 'vitepress';

import { useLandingCopy } from './copy';

const copy = useLandingCopy();

function resolve(href: string, external?: boolean): string {
	return external ? href : withBase(href);
}
</script>

<template>
	<section class="pv-section pv-demos">
		<p class="pv-kicker" data-reveal>{{ copy.demos.kicker }}</p>
		<h2 class="pv-h2" data-reveal="2">{{ copy.demos.title }}</h2>
		<p class="pv-copy" data-reveal="3">{{ copy.demos.copy }}</p>
		<div class="pv-demos__grid" data-reveal="3">
			<a
				v-for="card in copy.demos.cards"
				:key="card.name"
				class="pv-demos__card"
				:href="resolve(card.href, card.external)"
				:target="card.external ? '_blank' : undefined"
				:rel="card.external ? 'noreferrer' : undefined"
			>
				<span class="pv-demos__name">{{ card.name }}</span>
				<span class="pv-demos__desc">{{ card.desc }}</span>
				<span class="pv-demos__open">{{ copy.demos.open }} <i>&rarr;</i></span>
			</a>
		</div>
	</section>
</template>

<style scoped>
.pv-demos__grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 1.1rem;
	margin-top: 2.4rem;
}

.pv-demos__card {
	display: flex;
	flex-direction: column;
	gap: 0.7rem;
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 8px;
	padding: 1.5rem 1.5rem 1.6rem;
	transition:
		transform 0.3s cubic-bezier(0.25, 0.6, 0.3, 1),
		border-color 0.3s ease;
}

.pv-demos__card:hover {
	transform: translateY(-3px);
	border-color: var(--pv-accent);
}

.pv-demos__name {
	font-family: var(--pv-mono);
	font-size: 0.82rem;
	font-weight: 600;
	color: var(--pv-ink);
}

.pv-demos__desc {
	flex: 1;
	font-size: 0.86rem;
	line-height: 1.65;
	color: var(--pv-ink-soft);
}

.pv-demos__open {
	font-family: var(--pv-mono);
	font-size: 0.66rem;
	letter-spacing: 0.16em;
	text-transform: uppercase;
	color: var(--pv-accent);
}

.pv-demos__open i {
	font-style: normal;
}

@media (max-width: 1100px) {
	.pv-demos__grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@media (max-width: 560px) {
	.pv-demos__grid {
		grid-template-columns: 1fr;
	}
}
</style>
