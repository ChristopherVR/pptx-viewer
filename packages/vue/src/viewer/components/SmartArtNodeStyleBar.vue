<template>
	<div
		class="flex gap-1 px-1.5 py-1 bg-white/90 shadow-sm rounded-full border border-border"
		@mousedown.stop
		@click.stop
	>
		<button
			v-for="color in palette.slice(0, 6)"
			:key="color"
			type="button"
			:aria-label="t('pptx.smartArt.setFill', { color })"
			class="w-3.5 h-3.5 rounded-full border border-black/10 hover:scale-125 transition-transform"
			:style="{ background: color }"
			@click="$emit('pickFill', color)"
		/>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ palette: string[] }>();
defineEmits<{ pickFill: [color: string] }>();

const { t } = useI18n();
</script>
