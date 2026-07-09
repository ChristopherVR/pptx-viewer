<script setup lang="ts">
import { withBase } from 'vitepress';

import SlideCanvas from './SlideCanvas.vue';
</script>

<template>
	<section class="pv-hero" data-slide>
		<div class="pv-hero__inner">
			<div class="pv-hero__copy">
				<p class="pv-kicker pv-enter">Open source &middot; Apache-2.0 &middot; TypeScript</p>
				<h1 class="pv-hero__title pv-enter pv-enter--2">
					The PowerPoint engine<br />
					<em>for the web.</em>
				</h1>
				<p class="pv-hero__sub pv-enter pv-enter--3">
					pptx-viewer parses, renders, edits, and saves .pptx files entirely in the browser or
					Node.js. Real HTML and SVG rendering, full round-trip fidelity, and drop-in viewer
					components for React, Vue, and Angular.
				</p>
				<div class="pv-hero__actions pv-enter pv-enter--4">
					<a class="pv-btn pv-btn--solid" :href="withBase('/guide/introduction')">
						<span>Get started</span>
					</a>
					<a class="pv-btn pv-btn--ghost" href="https://christophervr.github.io/pptx-viewer/demo/">
						<span>Open the live demo</span>
					</a>
				</div>
				<code class="pv-hero__install pv-enter pv-enter--4">npm install pptx-react-viewer</code>
			</div>
			<div class="pv-hero__stage pv-enter pv-enter--3">
				<SlideCanvas />
			</div>
		</div>
		<div class="pv-hero__cue" aria-hidden="true">
			<span>Scroll</span>
			<i></i>
		</div>
	</section>
</template>

<style scoped>
.pv-hero {
	position: relative;
	min-height: calc(100vh - var(--vp-nav-height, 64px));
	display: flex;
	align-items: center;
	background-image: radial-gradient(
		color-mix(in srgb, var(--pv-ink) 9%, transparent) 1px,
		transparent 1px
	);
	background-size: 26px 26px;
}

.pv-hero__inner {
	width: 100%;
	max-width: 84rem;
	margin: 0 auto;
	padding: clamp(3rem, 8vh, 6rem) clamp(1.4rem, 5vw, 4.5rem) clamp(5rem, 12vh, 8rem);
	display: grid;
	grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
	gap: clamp(2rem, 5vw, 5rem);
	align-items: center;
}

.pv-hero__title {
	font-family: var(--pv-display);
	font-size: clamp(2.7rem, 6.2vw, 5.2rem);
	font-weight: 680;
	line-height: 0.99;
	letter-spacing: -0.025em;
	margin: 1.4rem 0 1.6rem;
}

.pv-hero__title em {
	font-style: italic;
	font-weight: 460;
	color: var(--pv-accent);
}

.pv-hero__sub {
	font-size: clamp(1rem, 1.4vw, 1.12rem);
	line-height: 1.75;
	color: var(--pv-ink-soft);
	max-width: 33rem;
}

.pv-hero__actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.9rem;
	margin-top: 2.2rem;
}

.pv-hero__install {
	display: inline-block;
	margin-top: 1.6rem;
	font-family: var(--pv-mono);
	font-size: 0.8rem;
	color: var(--pv-ink-soft);
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 3px;
	padding: 0.55em 1em;
}

.pv-hero__install::before {
	content: '$ ';
	color: var(--pv-accent);
}

.pv-hero__cue {
	position: absolute;
	bottom: 1.6rem;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.6rem;
}

.pv-hero__cue span {
	font-family: var(--pv-mono);
	font-size: 0.66rem;
	letter-spacing: 0.36em;
	text-transform: uppercase;
	color: var(--pv-ink-soft);
}

.pv-hero__cue i {
	width: 1px;
	height: 44px;
	background: var(--pv-line);
	overflow: hidden;
	position: relative;
}

.pv-hero__cue i::after {
	content: '';
	position: absolute;
	inset: 0;
	background: var(--pv-accent);
	animation: pv-cue 2s cubic-bezier(0.7, 0, 0.3, 1) infinite;
}

@keyframes pv-cue {
	0% {
		transform: translateY(-100%);
	}

	55%,
	100% {
		transform: translateY(100%);
	}
}

@media (max-width: 900px) {
	.pv-hero {
		min-height: 0;
	}

	.pv-hero__inner {
		grid-template-columns: 1fr;
	}

	.pv-hero__cue {
		display: none;
	}
}

@media (prefers-reduced-motion: reduce) {
	.pv-hero__cue i::after {
		animation: none;
	}
}
</style>
