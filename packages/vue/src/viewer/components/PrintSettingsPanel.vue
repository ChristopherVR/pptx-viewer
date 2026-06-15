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
	<div class="pptx-vue-print-settings">
		<!-- Print What -->
		<fieldset class="pptx-vue-print-fieldset">
			<legend class="pptx-vue-print-legend">Print what</legend>
			<div class="pptx-vue-print-grid">
				<label
					v-for="opt in PRINT_WHAT_OPTIONS"
					:key="opt.value"
					class="pptx-vue-print-card"
					:class="{ 'pptx-vue-print-card--active': props.printWhat === opt.value }"
				>
					<input
						type="radio"
						name="printWhat"
						class="pptx-vue-print-sr-only"
						:checked="props.printWhat === opt.value"
						@change="emit('update:printWhat', opt.value)"
					/>
					{{ opt.label }}
				</label>
			</div>
		</fieldset>

		<!-- Handout options -->
		<fieldset v-if="props.printWhat === 'handouts'" class="pptx-vue-print-fieldset">
			<legend class="pptx-vue-print-legend">Slides per page</legend>
			<div class="pptx-vue-print-chips">
				<button
					v-for="n in HANDOUT_OPTIONS"
					:key="n"
					type="button"
					class="pptx-vue-print-chip"
					:class="{ 'pptx-vue-print-chip--active': props.slidesPerPage === n }"
					@click="emit('update:slidesPerPage', n)"
				>
					{{ n }}
				</button>
			</div>
		</fieldset>

		<!-- Slide Range -->
		<fieldset class="pptx-vue-print-fieldset">
			<legend class="pptx-vue-print-legend">Slide range</legend>
			<div class="pptx-vue-print-stack">
				<label
					class="pptx-vue-print-card"
					:class="{ 'pptx-vue-print-card--active': props.slideRange === 'all' }"
				>
					<input
						type="radio"
						name="slideRange"
						class="pptx-vue-print-sr-only"
						:checked="props.slideRange === 'all'"
						@change="emit('update:slideRange', 'all')"
					/>
					All slides ({{ props.totalSlides }})
				</label>
				<label
					class="pptx-vue-print-card"
					:class="{ 'pptx-vue-print-card--active': props.slideRange === 'current' }"
				>
					<input
						type="radio"
						name="slideRange"
						class="pptx-vue-print-sr-only"
						:checked="props.slideRange === 'current'"
						@change="emit('update:slideRange', 'current')"
					/>
					Current slide ({{ props.activeSlideIndex + 1 }})
				</label>
				<label
					class="pptx-vue-print-card"
					:class="{ 'pptx-vue-print-card--active': props.slideRange === 'custom' }"
				>
					<input
						type="radio"
						name="slideRange"
						class="pptx-vue-print-sr-only"
						:checked="props.slideRange === 'custom'"
						@change="emit('update:slideRange', 'custom')"
					/>
					Custom range
				</label>
				<div v-if="props.slideRange === 'custom'" class="pptx-vue-print-range">
					<span class="pptx-vue-print-range-label">From</span>
					<input
						type="number"
						:min="1"
						:max="props.totalSlides"
						:value="props.customFrom"
						class="pptx-vue-print-number"
						@input="onCustomFromInput"
					/>
					<span class="pptx-vue-print-range-label">To</span>
					<input
						type="number"
						:min="1"
						:max="props.totalSlides"
						:value="props.customTo"
						class="pptx-vue-print-number"
						@input="onCustomToInput"
					/>
				</div>
			</div>
		</fieldset>

		<!-- Orientation — only for full-page slides -->
		<fieldset v-if="props.printWhat === 'slides'" class="pptx-vue-print-fieldset">
			<legend class="pptx-vue-print-legend">Orientation</legend>
			<div class="pptx-vue-print-row">
				<label
					class="pptx-vue-print-card"
					:class="{ 'pptx-vue-print-card--active': props.orientation === 'landscape' }"
				>
					<input
						type="radio"
						name="orientation"
						class="pptx-vue-print-sr-only"
						:checked="props.orientation === 'landscape'"
						@change="emit('update:orientation', 'landscape')"
					/>
					Landscape
				</label>
				<label
					class="pptx-vue-print-card"
					:class="{ 'pptx-vue-print-card--active': props.orientation === 'portrait' }"
				>
					<input
						type="radio"
						name="orientation"
						class="pptx-vue-print-sr-only"
						:checked="props.orientation === 'portrait'"
						@change="emit('update:orientation', 'portrait')"
					/>
					Portrait
				</label>
			</div>
		</fieldset>

		<!-- Colour Mode -->
		<fieldset class="pptx-vue-print-fieldset">
			<legend class="pptx-vue-print-legend">Color mode</legend>
			<div class="pptx-vue-print-row">
				<label
					v-for="opt in COLOR_OPTIONS"
					:key="opt.value"
					class="pptx-vue-print-card"
					:class="{ 'pptx-vue-print-card--active': props.colorMode === opt.value }"
				>
					<input
						type="radio"
						name="colorMode"
						class="pptx-vue-print-sr-only"
						:checked="props.colorMode === opt.value"
						@change="emit('update:colorMode', opt.value)"
					/>
					{{ opt.label }}
				</label>
			</div>
		</fieldset>

		<!-- Frame Slides -->
		<label class="pptx-vue-print-checkbox">
			<input
				type="checkbox"
				:checked="props.frameSlides"
				@change="emit('update:frameSlides', ($event.target as HTMLInputElement).checked)"
			/>
			<span>Frame slides</span>
		</label>
	</div>
</template>

<style scoped>
.pptx-vue-print-settings {
	display: flex;
	flex-direction: column;
	gap: 18px;
	flex: 1;
	min-width: 0;
}

.pptx-vue-print-fieldset {
	margin: 0;
	padding: 0;
	border: none;
}

.pptx-vue-print-legend {
	padding: 0;
	margin-bottom: 8px;
	font-size: 11px;
	font-weight: 500;
	letter-spacing: 0.04em;
	text-transform: uppercase;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-print-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
}

.pptx-vue-print-stack {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.pptx-vue-print-row {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.pptx-vue-print-card {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	font-size: 13px;
	cursor: pointer;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 8px;
	background: var(--pptx-vue-background, #ffffff);
	color: var(--pptx-vue-muted-foreground, #6b7280);
	transition:
		border-color 0.15s,
		background 0.15s,
		color 0.15s;
}

.pptx-vue-print-card:hover {
	border-color: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-print-card--active {
	border-color: var(--pptx-vue-primary, #2563eb);
	background: color-mix(in srgb, var(--pptx-vue-primary, #2563eb) 10%, transparent);
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-print-sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}

.pptx-vue-print-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.pptx-vue-print-chip {
	padding: 6px 12px;
	font-size: 13px;
	font-weight: 500;
	cursor: pointer;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 6px;
	background: var(--pptx-vue-background, #ffffff);
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-print-chip:hover {
	border-color: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-print-chip--active {
	border-color: var(--pptx-vue-primary, #2563eb);
	background: color-mix(in srgb, var(--pptx-vue-primary, #2563eb) 10%, transparent);
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-print-range {
	display: flex;
	align-items: center;
	gap: 8px;
	padding-left: 24px;
}

.pptx-vue-print-range-label {
	font-size: 11px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-print-number {
	width: 64px;
	padding: 4px 8px;
	font-size: 13px;
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-background, #ffffff);
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
}

.pptx-vue-print-checkbox {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 13px;
	cursor: pointer;
	color: var(--pptx-vue-foreground, #111827);
}
</style>
