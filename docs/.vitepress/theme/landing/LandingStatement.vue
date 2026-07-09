<script setup lang="ts">
import { useLandingCopy } from './copy';

const copy = useLandingCopy();
</script>

<template>
	<section class="pv-section pv-statement">
		<p class="pv-kicker" data-reveal>{{ copy.statement.kicker }}</p>
		<h2 class="pv-statement__text">
			<span data-reveal>{{ copy.statement.line1 }}</span>
			<span data-reveal="2">
				{{ copy.statement.line2Pre }}<em>{{ copy.statement.line2Em }}</em
				>{{ copy.statement.line2Post }}
			</span>
			<span data-reveal="3">{{ copy.statement.line3 }}</span>
		</h2>
	</section>
</template>

<style scoped>
.pv-statement {
	text-align: center;
	max-width: 68rem;
}

.pv-statement__text {
	margin-top: 2.2rem;
	font-family: var(--pv-display);
	font-size: clamp(1.7rem, 3.9vw, 3.1rem);
	font-weight: 560;
	line-height: 1.28;
	letter-spacing: -0.015em;
}

.pv-statement__text span {
	display: block;
}

.pv-statement__text em {
	font-style: italic;
	color: var(--pv-accent);
}
</style>
