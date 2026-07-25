<script setup lang="ts">
/**
 * PresentationEndScreen - the black "End of slide show" screen shown once the
 * show has run past its last slide, when Options > Advanced > "End with black
 * slide" is on. A click (or the next forward advance) exits the presentation.
 *
 * Without it the end-of-show state was invisible: the deck kept painting its
 * last slide, a backward press was silently swallowed and the next forward
 * press ended the show with no warning (issue #106). Vue port of React's
 * `PresentationEndOverlay`.
 */
import { useI18n } from 'vue-i18n';

defineEmits<{ (e: 'exit'): void }>();

const { t } = useI18n();
</script>

<template>
	<button
		type="button"
		class="pptx-vue-presentation-end absolute inset-0 z-[90] flex cursor-default items-start bg-black text-left"
		data-pptx-end-of-show
		@click.stop="$emit('exit')"
	>
		<span class="px-4 py-3 text-[12px] text-white/70">
			{{ t('pptx.presentation.endOfSlideShow') }}
		</span>
	</button>
</template>
