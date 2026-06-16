<script setup lang="ts">
/**
 * PrintSettingsPanel — the settings fieldset shown inside {@link PrintDialog}.
 *
 * Vue port of the React `PrintSettingsPanel.tsx`. Presentational: the parent
 * (`PrintDialog`) owns all state via `v-model`-style props + `update:*` emits.
 * Hand-written scoped CSS (no Tailwind), class names prefixed `pptx-vue-`.
 */
import { HANDOUT_OPTIONS } from './print-dialog-types';
import type {
	HandoutSlidesPerPage,
	PrintColorMode,
	PrintOrientation,
	PrintSlideRange,
	PrintWhat,
} from './print-dialog-types';

const props = defineProps<{
	printWhat: PrintWhat;
	orientation: PrintOrientation;
	colorMode: PrintColorMode;
	frameSlides: boolean;
	slidesPerPage: HandoutSlidesPerPage;
	slideRange: PrintSlideRange;
	customFrom: number;
	customTo: number;
	totalSlides: number;
	activeSlideIndex: number;
}>();

const emit = defineEmits<{
	'update:printWhat': [value: PrintWhat];
	'update:orientation': [value: PrintOrientation];
	'update:colorMode': [value: PrintColorMode];
	'update:frameSlides': [value: boolean];
	'update:slidesPerPage': [value: HandoutSlidesPerPage];
	'update:slideRange': [value: PrintSlideRange];
	'update:customFrom': [value: number];
	'update:customTo': [value: number];
}>();

const PRINT_WHAT_OPTIONS: { value: PrintWhat; label: string }[] = [
	{ value: 'slides', label: 'Full-page slides' },
	{ value: 'handouts', label: 'Handouts' },
	{ value: 'notes', label: 'Notes pages' },
	{ value: 'outline', label: 'Outline' },
];

const COLOR_OPTIONS: { value: PrintColorMode; label: string }[] = [
	{ value: 'color', label: 'Color' },
	{ value: 'grayscale', label: 'Grayscale' },
	{ value: 'blackAndWhite', label: 'Black & white' },
];

function parseRangeInput(raw: string): number {
	return Math.max(1, Number.parseInt(raw, 10) || 1);
}

function onCustomFromInput(event: Event): void {
	emit('update:customFrom', parseRangeInput((event.target as HTMLInputElement).value));
}

function onCustomToInput(event: Event): void {
	emit('update:customTo', parseRangeInput((event.target as HTMLInputElement).value));
}
</script>

<template>
	<div class="pptx-vue-print-settings flex min-w-0 flex-1 flex-col gap-5">
		<!-- Print What -->
		<fieldset class="pptx-vue-print-fieldset m-0 border-none p-0">
			<legend
				class="pptx-vue-print-legend mb-2 p-0 text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				Print what
			</legend>
			<div class="pptx-vue-print-grid grid grid-cols-2 gap-2">
				<label
					v-for="opt in PRINT_WHAT_OPTIONS"
					:key="opt.value"
					class="pptx-vue-print-card flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
					:class="
						props.printWhat === opt.value
							? 'pptx-vue-print-card--active border-primary bg-primary/10 text-foreground'
							: 'border-border bg-background text-muted-foreground hover:border-primary/40'
					"
				>
					<input
						type="radio"
						name="printWhat"
						class="pptx-vue-print-sr-only sr-only"
						:checked="props.printWhat === opt.value"
						@change="emit('update:printWhat', opt.value)"
					/>
					{{ opt.label }}
				</label>
			</div>
		</fieldset>

		<!-- Handout options -->
		<fieldset
			v-if="props.printWhat === 'handouts'"
			class="pptx-vue-print-fieldset m-0 border-none p-0"
		>
			<legend
				class="pptx-vue-print-legend mb-2 p-0 text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				Slides per page
			</legend>
			<div class="pptx-vue-print-chips flex flex-wrap gap-1.5">
				<button
					v-for="n in HANDOUT_OPTIONS"
					:key="n"
					type="button"
					class="pptx-vue-print-chip rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
					:class="
						props.slidesPerPage === n
							? 'pptx-vue-print-chip--active border-primary bg-primary/10 text-foreground'
							: 'border-border bg-background text-muted-foreground hover:border-primary/40'
					"
					@click="emit('update:slidesPerPage', n)"
				>
					{{ n }}
				</button>
			</div>
		</fieldset>

		<!-- Slide Range -->
		<fieldset class="pptx-vue-print-fieldset m-0 border-none p-0">
			<legend
				class="pptx-vue-print-legend mb-2 p-0 text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				Slide range
			</legend>
			<div class="pptx-vue-print-stack flex flex-col gap-2">
				<label
					class="pptx-vue-print-card flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
					:class="
						props.slideRange === 'all'
							? 'pptx-vue-print-card--active border-primary bg-primary/10 text-foreground'
							: 'border-border bg-background text-muted-foreground hover:border-primary/40'
					"
				>
					<input
						type="radio"
						name="slideRange"
						class="pptx-vue-print-sr-only sr-only"
						:checked="props.slideRange === 'all'"
						@change="emit('update:slideRange', 'all')"
					/>
					All slides ({{ props.totalSlides }})
				</label>
				<label
					class="pptx-vue-print-card flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
					:class="
						props.slideRange === 'current'
							? 'pptx-vue-print-card--active border-primary bg-primary/10 text-foreground'
							: 'border-border bg-background text-muted-foreground hover:border-primary/40'
					"
				>
					<input
						type="radio"
						name="slideRange"
						class="pptx-vue-print-sr-only sr-only"
						:checked="props.slideRange === 'current'"
						@change="emit('update:slideRange', 'current')"
					/>
					Current slide ({{ props.activeSlideIndex + 1 }})
				</label>
				<label
					class="pptx-vue-print-card flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
					:class="
						props.slideRange === 'custom'
							? 'pptx-vue-print-card--active border-primary bg-primary/10 text-foreground'
							: 'border-border bg-background text-muted-foreground hover:border-primary/40'
					"
				>
					<input
						type="radio"
						name="slideRange"
						class="pptx-vue-print-sr-only sr-only"
						:checked="props.slideRange === 'custom'"
						@change="emit('update:slideRange', 'custom')"
					/>
					Custom range
				</label>
				<div
					v-if="props.slideRange === 'custom'"
					class="pptx-vue-print-range flex items-center gap-2 pl-6"
				>
					<span class="pptx-vue-print-range-label text-xs text-muted-foreground">From</span>
					<input
						type="number"
						:min="1"
						:max="props.totalSlides"
						:value="props.customFrom"
						class="pptx-vue-print-number w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
						@input="onCustomFromInput"
					/>
					<span class="pptx-vue-print-range-label text-xs text-muted-foreground">To</span>
					<input
						type="number"
						:min="1"
						:max="props.totalSlides"
						:value="props.customTo"
						class="pptx-vue-print-number w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
						@input="onCustomToInput"
					/>
				</div>
			</div>
		</fieldset>

		<!-- Orientation — only for full-page slides -->
		<fieldset
			v-if="props.printWhat === 'slides'"
			class="pptx-vue-print-fieldset m-0 border-none p-0"
		>
			<legend
				class="pptx-vue-print-legend mb-2 p-0 text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				Orientation
			</legend>
			<div class="pptx-vue-print-row flex flex-wrap gap-2">
				<label
					class="pptx-vue-print-card flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
					:class="
						props.orientation === 'landscape'
							? 'pptx-vue-print-card--active border-primary bg-primary/10 text-foreground'
							: 'border-border bg-background text-muted-foreground hover:border-primary/40'
					"
				>
					<input
						type="radio"
						name="orientation"
						class="pptx-vue-print-sr-only sr-only"
						:checked="props.orientation === 'landscape'"
						@change="emit('update:orientation', 'landscape')"
					/>
					Landscape
				</label>
				<label
					class="pptx-vue-print-card flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
					:class="
						props.orientation === 'portrait'
							? 'pptx-vue-print-card--active border-primary bg-primary/10 text-foreground'
							: 'border-border bg-background text-muted-foreground hover:border-primary/40'
					"
				>
					<input
						type="radio"
						name="orientation"
						class="pptx-vue-print-sr-only sr-only"
						:checked="props.orientation === 'portrait'"
						@change="emit('update:orientation', 'portrait')"
					/>
					Portrait
				</label>
			</div>
		</fieldset>

		<!-- Colour Mode -->
		<fieldset class="pptx-vue-print-fieldset m-0 border-none p-0">
			<legend
				class="pptx-vue-print-legend mb-2 p-0 text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				Color mode
			</legend>
			<div class="pptx-vue-print-row flex flex-wrap gap-2">
				<label
					v-for="opt in COLOR_OPTIONS"
					:key="opt.value"
					class="pptx-vue-print-card flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
					:class="
						props.colorMode === opt.value
							? 'pptx-vue-print-card--active border-primary bg-primary/10 text-foreground'
							: 'border-border bg-background text-muted-foreground hover:border-primary/40'
					"
				>
					<input
						type="radio"
						name="colorMode"
						class="pptx-vue-print-sr-only sr-only"
						:checked="props.colorMode === opt.value"
						@change="emit('update:colorMode', opt.value)"
					/>
					{{ opt.label }}
				</label>
			</div>
		</fieldset>

		<!-- Frame Slides -->
		<label
			class="pptx-vue-print-checkbox flex cursor-pointer items-center gap-2 text-sm text-foreground"
		>
			<input
				type="checkbox"
				class="rounded border-border"
				:checked="props.frameSlides"
				@change="emit('update:frameSlides', ($event.target as HTMLInputElement).checked)"
			/>
			<span>Frame slides</span>
		</label>
	</div>
</template>
