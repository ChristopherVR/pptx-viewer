<script setup lang="ts">
/**
 * RecentColorsRow: the "Recent colours" swatch row shown under a colour
 * picker once at least one colour has been used (`p:clrMru`, seeded and kept
 * by `useRecentColors`). Presentational only: clicking a swatch just emits
 * `pick`, the host applies it exactly like a picked-from-the-native-picker
 * colour (which folds it back to the front of the list too).
 */
import { useI18n } from 'vue-i18n';

defineProps<{
	colors: string[];
	disabled?: boolean;
}>();

const emit = defineEmits<{
	pick: [hex: string];
}>();

const { t } = useI18n();
</script>

<template>
	<div v-if="colors.length > 0" class="pptx-vue-recent-colors flex flex-col gap-1">
		<span class="pptx-vue-recent-colors__label text-[10px] text-muted-foreground">{{
			t('pptx.colorPicker.recentColors')
		}}</span>
		<div
			class="flex flex-wrap gap-1"
			data-testid="pptx-color-recent"
			:aria-label="t('pptx.colorPicker.recentColors')"
		>
			<button
				v-for="hex in colors"
				:key="hex"
				type="button"
				class="pptx-vue-recent-colors__swatch h-5 w-5 rounded border border-border"
				:style="{ backgroundColor: hex }"
				:title="hex"
				:aria-label="`Recent ${hex}`"
				:disabled="disabled"
				@click="emit('pick', hex)"
			/>
		</div>
	</div>
</template>
