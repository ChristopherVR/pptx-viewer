<script setup lang="ts">
/**
 * OptionsControlRow - one schema-driven File > Options control (toggle /
 * select / number / text), rendered from a shared `ViewerOptionsControl`
 * descriptor. Vue counterpart of the `ControlRow` helper inside React's
 * `OptionsPane.tsx`, split into its own SFC to keep `OptionsPane.vue` small.
 */
import { Info } from 'lucide-vue-next';
import { clampOptionNumber } from 'pptx-viewer-shared';
import type { ViewerOptions, ViewerOptionsControl, ViewerOptionsGroupId } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	control: ViewerOptionsControl;
	options: ViewerOptions;
	onOptionChange: (
		group: ViewerOptionsGroupId,
		key: string,
		value: boolean | number | string,
	) => void;
}>();

// oxlint-disable-next-line eslint/one-var -- distinct concern from `defineProps` above, forcing one statement hurts readability
const { t } = useI18n();

// oxlint-disable-next-line eslint/one-var -- distinct concern from `t` above, forcing one statement hurts readability
const value = computed<boolean | number | string | undefined>(() => {
	const group = props.options[props.control.group] as unknown as Record<string, unknown>;
	// oxlint-disable-next-line eslint/one-var -- distinct concern from the lookup above, forcing one statement hurts readability
	const raw = group[props.control.key];
	return typeof raw === 'boolean' || typeof raw === 'number' || typeof raw === 'string'
		? raw
		: undefined;
});

// oxlint-disable-next-line eslint/one-var -- distinct concern from `value` above, forcing one statement hurts readability
const label = computed(() => t(props.control.labelKey));
// oxlint-disable-next-line eslint/one-var -- distinct concern from `label` above, forcing one statement hurts readability
const infoText = computed(() => (props.control.infoKey ? t(props.control.infoKey) : undefined));

function emitChange(next: boolean | number | string): void {
	props.onOptionChange(props.control.group, props.control.key, next);
}

function onNumberInput(event: Event): void {
	if (props.control.kind !== 'number') {
		return;
	}
	const clamped = clampOptionNumber(
		(event.target as HTMLInputElement).value,
		props.control.min,
		props.control.max,
	);
	if (clamped !== undefined) {
		emitChange(clamped);
	}
}
</script>

<template>
	<label
		v-if="control.kind === 'toggle'"
		class="pptx-vue-options-row flex cursor-pointer select-none items-center justify-between gap-3 py-1.5"
		:class="{ 'pl-6': control.indent }"
	>
		<span class="text-sm text-foreground">
			{{ label }}
			<span v-if="infoText" :title="infoText" class="inline-flex cursor-help align-middle">
				<Info class="ml-1 h-3.5 w-3.5 text-primary/70" :aria-label="infoText" />
			</span>
		</span>
		<input
			type="checkbox"
			class="h-4 w-4 shrink-0 accent-[var(--pptx-primary,#6366f1)]"
			:checked="value === true"
			@change="emitChange(($event.target as HTMLInputElement).checked)"
		/>
	</label>

	<div
		v-else
		class="pptx-vue-options-row flex items-center justify-between gap-3 py-1.5"
		:class="{ 'pl-6': control.indent }"
	>
		<span class="text-sm text-foreground">
			{{ label }}
			<span v-if="infoText" :title="infoText" class="inline-flex cursor-help align-middle">
				<Info class="ml-1 h-3.5 w-3.5 text-primary/70" :aria-label="infoText" />
			</span>
		</span>

		<select
			v-if="control.kind === 'select'"
			:aria-label="label"
			class="max-w-[55%] rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
			:value="typeof value === 'string' ? value : ''"
			@change="emitChange(($event.target as HTMLSelectElement).value)"
		>
			<option v-for="choice in control.choices" :key="choice.value" :value="choice.value">
				{{ t(choice.labelKey) }}
			</option>
		</select>

		<span v-else-if="control.kind === 'number'" class="flex items-center gap-1.5">
			<input
				type="number"
				:aria-label="label"
				class="w-20 rounded border border-border bg-background px-2 py-1 text-right text-xs text-foreground"
				:min="control.min"
				:max="control.max"
				:step="control.step ?? 1"
				:value="typeof value === 'number' ? value : control.min"
				@change="onNumberInput"
			/>
			<span v-if="control.unitKey" class="text-xs text-muted-foreground">
				{{ t(control.unitKey) }}
			</span>
		</span>

		<input
			v-else
			type="text"
			:aria-label="label"
			class="w-48 max-w-[55%] rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
			:maxlength="control.kind === 'text' ? control.maxLength : undefined"
			:value="typeof value === 'string' ? value : ''"
			@input="emitChange(($event.target as HTMLInputElement).value)"
		/>
	</div>
</template>
