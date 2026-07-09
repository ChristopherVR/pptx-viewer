<template>
	<div class="pv-veditor">
		<div class="pv-veditor__bar">
			<span class="pv-veditor__dots"><i></i><i></i><i></i></span>
			<span>christophervr.github.io/pptx-viewer/demo</span>
		</div>
		<img
			src="https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/editor.png"
			alt="The pptx-viewer editor: ribbon toolbar, slide thumbnails, and a slide rendered on the canvas"
			loading="lazy"
			width="1280"
			height="720"
		/>
	</div>
</template>

<style scoped>
.pv-veditor {
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 8px;
	overflow: hidden;
	box-shadow: var(--pv-shadow);
}

.pv-veditor__bar {
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

.pv-veditor__dots {
	display: inline-flex;
	gap: 0.3rem;
}

.pv-veditor__dots i {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--pv-line);
}

.pv-veditor img {
	display: block;
	width: 100%;
	height: auto;
}
</style>
