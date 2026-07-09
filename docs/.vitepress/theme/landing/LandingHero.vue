<script setup lang="ts">
import { withBase } from 'vitepress';

import { useLandingCopy } from './copy';

const DEMO_URL = 'https://christophervr.github.io/pptx-viewer/demo/';
const copy = useLandingCopy();
</script>

<template>
	<section class="pv-hero">
		<div class="pv-hero__inner">
			<div class="pv-hero__copy">
				<p class="pv-kicker pv-enter">{{ copy.hero.kicker }}</p>
				<h1 class="pv-hero__title pv-enter pv-enter--2">
					{{ copy.hero.titleTop }}<br />
					<em>{{ copy.hero.titleAccent }}</em>
				</h1>
				<p class="pv-hero__sub pv-enter pv-enter--3">{{ copy.hero.sub }}</p>
				<div class="pv-hero__actions pv-enter pv-enter--4">
					<a class="pv-btn pv-btn--solid" :href="withBase(copy.hero.start.href)">
						<span>{{ copy.hero.start.text }}</span>
					</a>
					<a class="pv-btn pv-btn--ghost" :href="DEMO_URL">
						<span>{{ copy.hero.demo }}</span>
					</a>
				</div>
				<code class="pv-hero__install pv-enter pv-enter--4">npm install pptx-react-viewer</code>
			</div>
			<div class="pv-hero__stage pv-enter pv-enter--3">
				<a class="pv-hero__frame" :href="DEMO_URL">
					<span class="pv-hero__framebar">
						<span class="pv-hero__dots" aria-hidden="true"><i></i><i></i><i></i></span>
						<span class="pv-hero__framefile">{{ copy.hero.frameCaption }}</span>
						<span class="pv-hero__frametry">{{ copy.hero.frameTry }} &rarr;</span>
					</span>
					<img
						:src="withBase('/hero-viewer.gif')"
						alt="The pptx viewer editing a real deck: flipping slides, dragging an element, and rendering a chart"
						width="960"
						height="540"
						fetchpriority="high"
					/>
				</a>
			</div>
		</div>
		<div class="pv-hero__cue" aria-hidden="true">
			<span>{{ copy.hero.scroll }}</span>
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

.pv-hero__frame {
	display: block;
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 8px;
	overflow: hidden;
	box-shadow: var(--pv-shadow);
	transition:
		transform 0.35s cubic-bezier(0.25, 0.6, 0.3, 1),
		border-color 0.35s ease;
}

.pv-hero__frame:hover {
	transform: translateY(-4px);
	border-color: var(--pv-accent);
}

.pv-hero__framebar {
	display: flex;
	align-items: center;
	gap: 0.9rem;
	padding: 0.6rem 0.9rem;
	border-bottom: 1px solid var(--pv-line);
	font-family: var(--pv-mono);
	font-size: 0.68rem;
	color: var(--pv-ink-soft);
	letter-spacing: 0.05em;
}

.pv-hero__dots {
	display: inline-flex;
	gap: 0.3rem;
}

.pv-hero__dots i {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--pv-line);
}

.pv-hero__frametry {
	margin-left: auto;
	color: var(--pv-accent);
	letter-spacing: 0.16em;
	text-transform: uppercase;
	white-space: nowrap;
}

.pv-hero__frame img {
	display: block;
	width: 100%;
	height: auto;
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
