<script setup lang="ts">
defineProps<{
	num: string;
	kicker: string;
	title: string;
	linkHref: string;
	linkText: string;
	flip?: boolean;
}>();
</script>

<template>
	<section class="pv-panel" :class="{ 'pv-panel--flip': flip }" data-slide>
		<div class="pv-panel__text">
			<span class="pv-slidenum" data-reveal>Slide {{ num }}</span>
			<p class="pv-kicker pv-panel__kicker" data-reveal>{{ kicker }}</p>
			<h2 class="pv-h2" data-reveal="2">{{ title }}</h2>
			<div class="pv-copy" data-reveal="3">
				<slot />
			</div>
			<a class="pv-link" :href="linkHref" data-reveal="3">
				{{ linkText }}
				<i>&rarr;</i>
			</a>
		</div>
		<div class="pv-panel__visual" data-reveal="2">
			<slot name="visual" />
		</div>
	</section>
</template>

<style scoped>
.pv-panel {
	max-width: 84rem;
	margin: 0 auto;
	padding: clamp(4rem, 10vh, 7.5rem) clamp(1.4rem, 5vw, 4.5rem);
	display: grid;
	grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
	gap: clamp(2rem, 5vw, 5rem);
	align-items: center;
}

.pv-panel--flip .pv-panel__text {
	order: 2;
}

.pv-panel--flip .pv-panel__visual {
	order: 1;
}

.pv-panel__kicker {
	display: block;
	margin-top: 1.6rem;
}

@media (max-width: 900px) {
	.pv-panel {
		grid-template-columns: 1fr;
	}

	.pv-panel--flip .pv-panel__text {
		order: 1;
	}

	.pv-panel--flip .pv-panel__visual {
		order: 2;
	}
}
</style>
