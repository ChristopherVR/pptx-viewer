<script setup lang="ts">
const frameworks = [
	{ name: 'React', pkg: 'pptx-react-viewer', tag: '<PowerPointViewer />' },
	{ name: 'Vue 3', pkg: 'pptx-vue-viewer', tag: '<PowerPointViewer />' },
	{ name: 'Angular', pkg: 'pptx-angular-viewer', tag: '<pptx-viewer />' },
];
</script>

<template>
	<div class="pv-vfw">
		<div
			v-for="(fw, i) in frameworks"
			:key="fw.name"
			class="pv-vfw__card"
			:class="`pv-vfw__card--${i}`"
		>
			<div class="pv-vfw__head">
				<span class="pv-vfw__name">{{ fw.name }}</span>
				<span class="pv-vfw__pkg">{{ fw.pkg }}</span>
			</div>
			<div class="pv-vfw__slide">
				<i class="pv-vfw__t"></i>
				<i class="pv-vfw__l1"></i>
				<i class="pv-vfw__l2"></i>
			</div>
			<code class="pv-vfw__tag">{{ fw.tag }}</code>
		</div>
	</div>
</template>

<style scoped>
.pv-vfw {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: clamp(0.8rem, 1.8vw, 1.4rem);
	align-items: stretch;
}

.pv-vfw__card {
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 8px;
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.9rem;
	transition:
		transform 0.35s cubic-bezier(0.25, 0.6, 0.3, 1),
		box-shadow 0.35s ease,
		border-color 0.35s ease;
}

.pv-vfw__card:hover {
	transform: translateY(-6px);
	box-shadow: var(--pv-shadow);
	border-color: var(--pv-accent);
}

.pv-vfw__head {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
}

.pv-vfw__name {
	font-family: var(--pv-display);
	font-weight: 640;
	font-size: 1rem;
}

.pv-vfw__pkg {
	font-family: var(--pv-mono);
	font-size: 0.62rem;
	letter-spacing: 0.06em;
	color: var(--pv-ink-soft);
}

/* The same miniature slide in each card: one engine */
.pv-vfw__slide {
	aspect-ratio: 16 / 9;
	border: 1px solid var(--pv-line);
	border-radius: 4px;
	padding: 10% 9%;
	background: var(--pv-accent-soft);
}

.pv-vfw__slide i {
	display: block;
	background: var(--pv-accent);
	border-radius: 1px;
}

.pv-vfw__t {
	width: 62%;
	height: 12%;
	margin-bottom: 12%;
}

.pv-vfw__l1,
.pv-vfw__l2 {
	opacity: 0.45;
	height: 7%;
	margin-bottom: 7%;
}

.pv-vfw__l1 {
	width: 84%;
}

.pv-vfw__l2 {
	width: 70%;
}

.pv-vfw__tag {
	font-family: var(--pv-mono);
	font-size: 0.66rem;
	color: var(--pv-accent);
	background: none;
}

@media (max-width: 560px) {
	.pv-vfw {
		grid-template-columns: 1fr;
	}
}
</style>
