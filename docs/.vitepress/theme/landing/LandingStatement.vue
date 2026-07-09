<template>
	<section class="pv-section pv-statement" data-slide>
		<p class="pv-kicker" data-reveal>Why it renders differently</p>
		<h2 class="pv-statement__text">
			<span data-reveal>Most viewers flatten slides into pictures.</span>
			<span data-reveal="2"> pptx-viewer renders them as live HTML, CSS, and SVG: </span>
			<span data-reveal="3">
				<em>text stays text</em>, sharp at any zoom, accessible by default.
			</span>
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
