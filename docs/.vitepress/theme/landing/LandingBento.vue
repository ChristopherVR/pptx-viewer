<script setup lang="ts">
import { withBase } from 'vitepress';

const tiles = [
	{
		title: 'Real-time collaboration',
		copy: 'Co-edit through a Yjs CRDT with presence tracking, character-level text merging, and a P2P transport that needs no server.',
		href: '/react/collaboration',
	},
	{
		title: 'Encryption',
		copy: 'Open and save password-protected files with AES-128 and AES-256 agile encryption.',
		href: '/core/encryption',
	},
	{
		title: 'Export everything',
		copy: 'PNG, JPEG, SVG, PDF, GIF, and video from the browser. SVG export also runs headlessly in Node.js with no DOM.',
		href: '/react/export',
	},
	{
		title: 'Convert to Markdown',
		copy: 'Turn decks into clean Markdown or positioned HTML, with media extraction, speaker notes, and metadata.',
		href: '/core/converter',
	},
	{
		title: 'Build from scratch',
		copy: 'A fluent builder API creates presentations programmatically: text, shapes, images, tables, and charts without raw OpenXML.',
		href: '/core/builder',
	},
	{
		title: 'Know the limits',
		copy: 'OLE objects are read-only and some effects are approximated on screen. The limitations page states exactly what to expect.',
		href: '/guide/limitations',
	},
];
</script>

<template>
	<section class="pv-section pv-bento">
		<p class="pv-kicker" data-reveal>And the rest of the spec sheet</p>
		<div class="pv-bento__grid">
			<a
				v-for="(tile, i) in tiles"
				:key="tile.title"
				class="pv-bento__tile"
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
