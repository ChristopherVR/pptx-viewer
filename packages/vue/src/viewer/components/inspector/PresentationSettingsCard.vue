<script setup lang="ts">
import type { PptxPresentationProperties } from 'pptx-viewer-core';
import {
	printPropertiesFrameSlides,
	printPropertiesSlidesPerPage,
	withFrameSlides,
	withSlidesPerPage,
} from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

/**
 * PresentationSettingsCard: deck-wide slide-show / print settings, shown in the
 * slide inspector. Vue port of the React `inspector/PresentationSettingsCards.tsx`
 * (`PresentationSettingsCard`). The parent owns `presentationProperties` and
 * commits each patch; the theme and slide-size cards from React are handled by
 * dedicated Vue surfaces and are not duplicated here.
 */
const props = withDefaults(
	defineProps<{
		presentationProperties: PptxPresentationProperties;
		canEdit?: boolean;
	}>(),
	{ canEdit: true },
);

const emit = defineEmits<{
	update: [patch: Partial<PptxPresentationProperties>];
}>();

const { t } = useI18n();

function onNumber(e: Event): number {
	return Number((e.target as HTMLInputElement).value);
}
</script>

<template>
	<div class="space-y-1.5 text-[11px]">
		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">{{ t('pptx.presentationSettings.showType') }}</span>
			<select
				class="w-28 rounded border border-border bg-muted px-2 py-1 text-xs"
				:disabled="!props.canEdit"
				:value="props.presentationProperties.showType ?? 'presented'"
				@change="
					emit('update', {
						showType: ($event.target as HTMLSelectElement).value as
							'presented' | 'browsed' | 'kiosk',
					})
				"
			>
				<option value="presented">{{ t('pptx.presentationSettings.showTypePresented') }}</option>
				<option value="browsed">{{ t('pptx.presentationSettings.showTypeBrowsed') }}</option>
				<option value="kiosk">{{ t('pptx.presentationSettings.showTypeKiosk') }}</option>
			</select>
		</label>

		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">{{
				t('pptx.presentationSettings.loopContinuously')
			}}</span>
			<input
				type="checkbox"
				:disabled="!props.canEdit"
				:checked="Boolean(props.presentationProperties.loopContinuously)"
				@change="emit('update', { loopContinuously: ($event.target as HTMLInputElement).checked })"
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">{{ t('pptx.presentationSettings.showNarration') }}</span>
			<input
				type="checkbox"
				:disabled="!props.canEdit"
				:checked="props.presentationProperties.showWithNarration !== false"
				@change="emit('update', { showWithNarration: ($event.target as HTMLInputElement).checked })"
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">{{ t('pptx.presentationSettings.showAnimation') }}</span>
			<input
				type="checkbox"
				:disabled="!props.canEdit"
				:checked="props.presentationProperties.showWithAnimation !== false"
				@change="emit('update', { showWithAnimation: ($event.target as HTMLInputElement).checked })"
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">{{ t('pptx.presentationSettings.frameSlides') }}</span>
			<input
				type="checkbox"
				:disabled="!props.canEdit"
				:checked="printPropertiesFrameSlides(props.presentationProperties.printProperties)"
				@change="
					emit('update', {
						printProperties: withFrameSlides(
							props.presentationProperties.printProperties,
							($event.target as HTMLInputElement).checked,
						),
					})
				"
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">{{ t('pptx.presentationSettings.slidesPerPage') }}</span>
			<input
				type="number"
				:min="1"
				:max="16"
				:disabled="!props.canEdit"
				class="w-20 rounded border border-border bg-muted px-2 py-1 text-xs"
				:value="printPropertiesSlidesPerPage(props.presentationProperties.printProperties)"
				@input="
					emit('update', {
						printProperties: withSlidesPerPage(
							props.presentationProperties.printProperties,
							onNumber($event),
						),
					})
				"
			/>
		</label>
	</div>
</template>
