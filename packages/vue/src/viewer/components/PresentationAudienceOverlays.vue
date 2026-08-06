<script setup lang="ts">
/**
 * PresentationAudienceOverlays: the three things a presenter can push onto the
 * audience display from presenter view (screen blackout, the laser dot, and the
 * live caption line).
 *
 * All three are driven purely by the presenter-session snapshot, which is why
 * they are grouped: they render nothing at all in a normal single-screen show,
 * and each one is positioned in the OVERLAY's coordinate space (percentages of
 * the viewport), not the slide's, so they must not sit inside the scaled frame.
 */
import type { PresentationSnapshot } from 'pptx-viewer-shared';

defineProps<{ snapshot: PresentationSnapshot }>();
</script>

<template>
	<!--
		The blackout sheet is decorative: PowerPoint still advances the show when
		the presenter clicks a blanked screen, and the ink overlay (raised above
		this sheet while blanked) must keep receiving the presses that draw on the
		"blackboard". A sheet that swallowed pointer input would strand the show.
	-->
	<div
		v-if="snapshot.blackout !== 'none'"
		class="pointer-events-none absolute inset-0 z-[75]"
		data-pptx-blackout
		:style="{ background: snapshot.blackout }"
	/>
	<div
		v-if="snapshot.pointer?.tool === 'laser'"
		class="pointer-events-none absolute z-[76] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500"
		:style="{
			left: `${(snapshot.pointer?.x ?? 0.5) * 100}%`,
			top: `${(snapshot.pointer?.y ?? 0.5) * 100}%`,
			boxShadow: '0 0 20px 8px rgba(239,68,68,.55)',
		}"
	/>
	<div
		v-if="snapshot.subtitlesVisible && snapshot.caption"
		class="pointer-events-none absolute inset-x-[10%] bottom-8 z-[77] rounded-lg bg-black/80 px-6 py-3 text-center text-xl text-white"
	>
		{{ snapshot.caption }}
	</div>
</template>
