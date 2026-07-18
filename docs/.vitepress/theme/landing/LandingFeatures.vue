<script setup lang="ts">
import { withBase } from 'vitepress';

import { useLandingCopy } from './copy';

const copy = useLandingCopy();
</script>

<template>
	<section class="pv-section pv-features">
		<p class="pv-kicker" data-reveal>{{ copy.features.kicker }}</p>
		<h2 class="pv-h2" data-reveal="2">{{ copy.features.title }}</h2>
		<div class="pv-features__grid" data-reveal="3">
			<article v-for="item in copy.features.items" :key="item.title" class="pv-features__card">
				<h3>{{ item.title }}</h3>
				<p>{{ item.copy }}</p>
				<a class="pv-features__link" :href="withBase(item.link.href)">
					{{ item.link.text }} <i>&rarr;</i>
				</a>
			</article>
		</div>
	</section>
</template>

<style scoped>
.pv-features__grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 1px;
	background: var(--pv-line);
	border: 1px solid var(--pv-line);
	border-radius: 8px;
	overflow: hidden;
	margin-top: 2.4rem;
}

.pv-features__card {
	display: flex;
	flex-direction: column;
	gap: 0.8rem;
	background: var(--pv-surface);
	padding: 1.7rem 1.6rem 1.9rem;
	transition: background-color 0.25s ease;
}

.pv-features__card:hover {
	background: var(--pv-accent-soft);
}

.pv-features__card h3 {
	font-family: var(--pv-display);
	font-size: 1.08rem;
	font-weight: 640;
	letter-spacing: -0.01em;
	line-height: 1.25;
	margin: 0;
}

.pv-features__card p {
	flex: 1;
	font-size: 0.88rem;
	line-height: 1.7;
	color: var(--pv-ink-soft);
	margin: 0;
}

.pv-features__link {
	font-family: var(--pv-mono);
	font-size: 0.68rem;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: var(--pv-ink);
	transition: color 0.2s ease;
}

.pv-features__link:hover {
	color: var(--pv-accent);
}

.pv-features__link i {
	font-style: normal;
	color: var(--pv-accent);
}

@media (max-width: 1100px) {
	.pv-features__grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@media (max-width: 560px) {
	.pv-features__grid {
		grid-template-columns: 1fr;
	}
}
</style>
