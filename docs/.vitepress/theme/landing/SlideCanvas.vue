<script setup lang="ts">
import './slide-canvas.css';
</script>

<template>
	<figure class="pv-canvas" aria-label="A PowerPoint slide being edited in the browser">
		<figcaption class="pv-canvas__bar">
			<span class="pv-canvas__dots"><i></i><i></i><i></i></span>
			<span class="pv-canvas__file">quarterly-review.pptx</span>
			<span class="pv-canvas__mode">Editing</span>
		</figcaption>
		<div class="pv-canvas__ruler" aria-hidden="true"></div>
		<div class="pv-canvas__slide">
			<div class="pv-canvas__title">Q3 Business Review</div>
			<div class="pv-canvas__rule"></div>
			<div class="pv-canvas__bullet pv-canvas__bullet--1">Revenue up 18% quarter over quarter</div>
			<div class="pv-canvas__bullet pv-canvas__bullet--2">
				Rendering costs down to zero canvases
			</div>
			<div class="pv-canvas__chart">
				<i class="pv-canvas__colbar pv-canvas__colbar--1"></i>
				<i class="pv-canvas__colbar pv-canvas__colbar--2"></i>
				<i class="pv-canvas__colbar pv-canvas__colbar--3"></i>
				<i class="pv-canvas__colbar pv-canvas__colbar--4"></i>
				<span class="pv-canvas__sel" aria-hidden="true">
					<b v-for="n in 8" :key="n" :class="`pv-canvas__h pv-canvas__h--${n}`"></b>
				</span>
			</div>
		</div>
		<div class="pv-canvas__status" aria-hidden="true">
			<span>Slide 1 of 12</span>
			<span>16:9 &middot; 12,192,000 EMU wide</span>
		</div>
	</figure>
</template>
