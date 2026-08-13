<script setup lang="ts">
/**
 * ThemeSelectorCard: THEME card (theme part dropdown + Apply First Master /
 * Apply All Masters), mirroring React's `ThemeSelectorCard` in
 * `inspector/PresentationSettingsCards.tsx`. The parent owns the selected path
 * (like React's `useInspectorPaneState`) and performs the actual apply.
 */
import type { PptxThemeOption } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

import { BTN, CARD, HEADING, INPUT } from './inspector-cards';

const props = withDefaults(
	defineProps<{
		themeOptions: PptxThemeOption[];
		selectedThemePath: string;
		canEdit?: boolean;
	}>(),
	{ canEdit: true },
);

const emit = defineEmits<{
	'select-theme-path': [path: string];
	'apply-theme': [path: string, allMasters: boolean];
}>();

const { t } = useI18n();

function onSelect(event: Event): void {
	emit('select-theme-path', (event.target as HTMLSelectElement).value);
}
</script>

<template>
	<div :class="CARD">
		<div :class="HEADING">{{ t('pptx.documentProperties.themeHeading') }}</div>
		<div class="space-y-2 text-[11px]">
			<label class="flex flex-col gap-1">
				<span class="text-muted-foreground">{{ t('pptx.documentProperties.themeHeading') }}</span>
				<!-- Nested in its `<label>`, so without this its accessible label would
				     be the caption plus every option: see `SlideTransitionPanel.vue`. -->
				<select
					:aria-label="t('pptx.documentProperties.themeHeading')"
					:disabled="props.themeOptions.length === 0"
					:class="INPUT"
					:value="props.selectedThemePath"
					@change="onSelect"
				>
					<option v-if="props.themeOptions.length === 0" value="">
						{{ t('pptx.documentProperties.noThemesOption') }}
					</option>
					<template v-else>
						<option v-for="opt in props.themeOptions" :key="opt.path" :value="opt.path">
							{{ opt.name || opt.path.split('/').pop() }}
						</option>
					</template>
				</select>
			</label>
			<div class="grid grid-cols-2 gap-1.5">
				<button
					type="button"
					:class="BTN"
					:disabled="!props.canEdit || !props.selectedThemePath"
					@click="emit('apply-theme', props.selectedThemePath, false)"
				>
					{{ t('pptx.documentProperties.applyFirstMaster') }}
				</button>
				<button
					type="button"
					:class="BTN"
					:disabled="!props.canEdit || !props.selectedThemePath"
					@click="emit('apply-theme', props.selectedThemePath, true)"
				>
					{{ t('pptx.documentProperties.applyAllMasters') }}
				</button>
			</div>
		</div>
	</div>
</template>
