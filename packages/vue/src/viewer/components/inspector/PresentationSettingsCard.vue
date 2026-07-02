<script setup lang="ts">
import type { PptxPresentationProperties } from 'pptx-viewer-core';

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

function onNumber(e: Event): number {
	return Number((e.target as HTMLInputElement).value);
}
</script>

<template>
	<div class="space-y-1.5 text-[11px]">
		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">Show type</span>
			<select
				class="w-28 rounded border border-border bg-muted px-2 py-1 text-xs"
				:disabled="!props.canEdit"
				:value="props.presentationProperties.showType ?? 'presented'"
				@change="
					emit('update', {
						showType: ($event.target as HTMLSelectElement).value as
							| 'presented'
							| 'browsed'
							| 'kiosk',
					})
				"
			>
				<option value="presented">Presented</option>
				<option value="browsed">Browsed</option>
				<option value="kiosk">Kiosk</option>
			</select>
		</label>

		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">Loop continuously</span>
			<input
				type="checkbox"
				:disabled="!props.canEdit"
				:checked="Boolean(props.presentationProperties.loopContinuously)"
				@change="emit('update', { loopContinuously: ($event.target as HTMLInputElement).checked })"
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">Show narration</span>
			<input
				type="checkbox"
				:disabled="!props.canEdit"
				:checked="props.presentationProperties.showWithNarration !== false"
				@change="emit('update', { showWithNarration: ($event.target as HTMLInputElement).checked })"
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">Show animation</span>
			<input
				type="checkbox"
				:disabled="!props.canEdit"
				:checked="props.presentationProperties.showWithAnimation !== false"
				@change="emit('update', { showWithAnimation: ($event.target as HTMLInputElement).checked })"
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">Frame slides</span>
			<input
				type="checkbox"
				:disabled="!props.canEdit"
				:checked="Boolean(props.presentationProperties.printFrameSlides)"
				@change="emit('update', { printFrameSlides: ($event.target as HTMLInputElement).checked })"
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">Slides / page</span>
			<input
				type="number"
				:min="1"
				:max="16"
				:disabled="!props.canEdit"
				class="w-20 rounded border border-border bg-muted px-2 py-1 text-xs"
				:value="props.presentationProperties.printSlidesPerPage ?? 1"
				@input="emit('update', { printSlidesPerPage: onNumber($event) })"
			/>
		</label>
	</div>
</template>
