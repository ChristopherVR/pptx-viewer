<script setup lang="ts">
const items = [
	'16 element types',
	'187+ preset shapes',
	'23 chart types',
	'OOXML Strict',
	'AES-128 / 256 encryption',
	'EMF + WMF metafiles',
	'embedded fonts',
	'SmartArt',
	'morph transitions',
	'Yjs collaboration',
	'25 MCP tools',
	'PNG · PDF · SVG · GIF · video export',
];
</script>

<template>
	<div class="pv-marquee" aria-hidden="true">
		<div class="pv-marquee__track">
			<span v-for="pass in 2" :key="pass" class="pv-marquee__run">
				<span v-for="item in items" :key="item" class="pv-marquee__item">
					{{ item }}
					<i></i>
				</span>
			</span>
		</div>
	</div>
</template>

<style scoped>
.pv-marquee {
	border-top: 1px solid var(--pv-line);
	border-bottom: 1px solid var(--pv-line);
	background: var(--pv-surface);
	overflow: hidden;
	padding: 0.95rem 0;
}

.pv-marquee__track {
	display: flex;
	width: max-content;
	animation: pv-marquee 46s linear infinite;
}

.pv-marquee__run {
	display: flex;
	flex-shrink: 0;
}

.pv-marquee__item {
	display: inline-flex;
	align-items: center;
	gap: 1.6rem;
	padding-right: 1.6rem;
	font-family: var(--pv-mono);
	font-size: 0.74rem;
	letter-spacing: 0.22em;
	text-transform: uppercase;
	color: var(--pv-ink-soft);
	white-space: nowrap;
}

.pv-marquee__item i {
	width: 0.55rem;
	height: 0.55rem;
	background: var(--pv-accent-soft);
	border: 1px solid var(--pv-accent);
	transform: rotate(45deg);
}

@keyframes pv-marquee {
	to {
		transform: translateX(-50%);
	}
}

@media (prefers-reduced-motion: reduce) {
	.pv-marquee__track {
		animation: none;
	}
}
</style>
