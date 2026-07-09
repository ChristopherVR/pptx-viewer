<script setup lang="ts">
import { withBase } from 'vitepress';
</script>

<template>
	<section class="pv-finale">
		<div class="pv-finale__inner">
			<span class="pv-finale__mark" aria-hidden="true"><i></i></span>
			<p class="pv-kicker pv-finale__kicker" data-reveal>Get started</p>
			<h2 class="pv-finale__title" data-reveal="2">Ship slides in your product this sprint.</h2>
			<p class="pv-finale__sub" data-reveal="3">
				Apache-2.0 licensed, strict TypeScript, zero native dependencies. Load a real deck in the
				demo, then wire the component into your app.
			</p>
			<div class="pv-finale__actions" data-reveal="3">
				<a class="pv-btn pv-btn--accent" :href="withBase('/guide/quick-start')">
					<span>Quick start</span>
				</a>
				<a class="pv-btn pv-btn--outline" href="https://github.com/ChristopherVR/pptx-viewer">
					<span>View on GitHub</span>
				</a>
			</div>
		</div>
		<div class="pv-finale__foot">
			<span>pptx-viewer &middot; the PowerPoint engine for the web</span>
			<span>Apache-2.0 &middot; TypeScript strict &middot; no native dependencies</span>
		</div>
	</section>
</template>

<style scoped>
.pv-finale {
	background: #14171b;
	color: #f0efec;
}

.dark .pv-finale {
	background: #0a0c0e;
	border-top: 1px solid var(--pv-line);
}

.pv-finale__inner {
	max-width: 84rem;
	margin: 0 auto;
	padding: clamp(6rem, 16vh, 11rem) clamp(1.4rem, 5vw, 4.5rem) clamp(4.5rem, 11vh, 8rem);
	text-align: center;
}

.pv-finale__mark {
	display: inline-grid;
	place-items: center;
	width: 3.2rem;
	height: 3.2rem;
	background: var(--pv-accent);
	border-radius: 6px;
	transform: rotate(-4deg);
	margin-bottom: 2rem;
}

.pv-finale__mark i {
	width: 1.5rem;
	height: calc(1.5rem * 9 / 16);
	border: 2px solid #fff;
	border-radius: 2px;
}

.pv-finale__kicker {
	display: block;
	letter-spacing: 0.42em;
}

.pv-finale__title {
	font-family: var(--pv-display);
	font-size: clamp(2.3rem, 5.6vw, 4.6rem);
	font-weight: 660;
	line-height: 1.02;
	letter-spacing: -0.02em;
	margin: 1.4rem auto 1.5rem;
	max-width: 20ch;
}

.pv-finale__sub {
	color: rgba(240, 239, 236, 0.62);
	line-height: 1.75;
	max-width: 36rem;
	margin: 0 auto;
}

.pv-finale__actions {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	gap: 0.9rem;
	margin-top: 2.8rem;
}

.pv-btn--accent {
	background: var(--pv-accent);
	border: 1px solid var(--pv-accent);
	color: #fff;
}

.pv-btn--accent::before {
	background: #fff;
}

.pv-btn--accent:hover {
	color: #14171b;
}

.pv-btn--outline {
	border: 1px solid rgba(240, 239, 236, 0.35);
	color: #f0efec;
}

.pv-btn--outline::before {
	background: #f0efec;
}

.pv-btn--outline:hover {
	color: #14171b;
	border-color: #f0efec;
}

.pv-finale__foot {
	max-width: 84rem;
	margin: 0 auto;
	padding: 1.4rem clamp(1.4rem, 5vw, 4.5rem) 2.4rem;
	border-top: 1px solid rgba(240, 239, 236, 0.12);
	display: flex;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.8rem;
	font-family: var(--pv-mono);
	font-size: 0.68rem;
	letter-spacing: 0.16em;
	color: rgba(240, 239, 236, 0.45);
}
</style>
