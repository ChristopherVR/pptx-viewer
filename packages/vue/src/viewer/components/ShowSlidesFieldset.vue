<script setup lang="ts">
import type { PptxCustomShow, PptxPresentationProperties } from 'pptx-viewer-core';

/**
 * ShowSlidesFieldset: which slides a slide show includes (all, a from/to
 * range, or a named custom show). Vue port of the React
 * `ShowSlidesFieldset.tsx`; the parent owns the `draft` and passes an `update`
 * patch callback so the fieldset stays presentational.
 */
const props = defineProps<{
	draft: PptxPresentationProperties;
	showSlidesMode: 'all' | 'customShow' | 'range';
	slideCount: number;
	customShows: PptxCustomShow[];
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxPresentationProperties>];
}>();

function setFrom(value: string): void {
	emit('update', { showSlidesFrom: Math.max(1, Number.parseInt(value, 10) || 1) });
}

function setTo(value: string): void {
	emit('update', {
		showSlidesTo: Math.min(props.slideCount, Number.parseInt(value, 10) || props.slideCount),
	});
}
</script>

<template>
	<fieldset class="space-y-1.5">
		<legend class="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
			Show slides
		</legend>

		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="radio"
				name="showSlides"
				value="all"
				class="accent-primary"
				:checked="showSlidesMode === 'all'"
				@change="emit('update', { showSlidesMode: 'all' })"
			/>
			<span>All slides</span>
		</label>

		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="radio"
				name="showSlides"
				value="range"
				class="accent-primary"
				:checked="showSlidesMode === 'range'"
				@change="
					emit('update', {
						showSlidesMode: 'range',
						showSlidesFrom: draft.showSlidesFrom ?? 1,
						showSlidesTo: draft.showSlidesTo ?? slideCount,
					})
				"
			/>
			<span>From / to</span>
		</label>
		<div v-if="showSlidesMode === 'range'" class="ml-6 flex items-center gap-2">
			<label class="flex items-center gap-1">
				<span class="text-muted-foreground">From</span>
				<input
					type="number"
					:min="1"
					:max="slideCount"
					:value="draft.showSlidesFrom ?? 1"
					class="w-14 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
					@input="setFrom(($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="flex items-center gap-1">
				<span class="text-muted-foreground">To</span>
				<input
					type="number"
					:min="1"
					:max="slideCount"
					:value="draft.showSlidesTo ?? slideCount"
					class="w-14 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
					@input="setTo(($event.target as HTMLInputElement).value)"
				/>
			</label>
		</div>

		<template v-if="customShows.length > 0">
			<label class="flex cursor-pointer items-center gap-2">
				<input
					type="radio"
					name="showSlides"
					value="customShow"
					class="accent-primary"
					:checked="showSlidesMode === 'customShow'"
					@change="
						emit('update', {
							showSlidesMode: 'customShow',
							showSlidesCustomShowId: draft.showSlidesCustomShowId ?? customShows[0]?.id,
						})
					"
				/>
				<span>Custom show</span>
			</label>
			<div v-if="showSlidesMode === 'customShow'" class="ml-6">
				<select
					class="w-full rounded border border-border bg-muted px-2 py-1 text-[11px] text-foreground"
					:value="draft.showSlidesCustomShowId ?? customShows[0]?.id ?? ''"
					@change="
						emit('update', {
							showSlidesCustomShowId: ($event.target as HTMLSelectElement).value,
						})
					"
				>
					<option v-for="cs in customShows" :key="cs.id" :value="cs.id">{{ cs.name }}</option>
				</select>
			</div>
		</template>
	</fieldset>
</template>
