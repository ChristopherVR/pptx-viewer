<script setup lang="ts">
import type { ElementAction, ElementActionType, PptxElement } from 'pptx-viewer-core';
import { elementActionToPptxAction, pptxActionToElementAction } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
	defineProps<{ element: PptxElement; slideCount?: number; canEdit?: boolean }>(),
	{ slideCount: 0, canEdit: true },
);
const emit = defineEmits<{ update: [patch: Partial<PptxElement>] }>();
const { t } = useI18n();

const OPTIONS: ReadonlyArray<{ value: ElementActionType; key: string }> = [
	{ value: 'none', key: 'pptx.hyperlink.actionNone' },
	{ value: 'url', key: 'pptx.action.gotoUrl' },
	{ value: 'slide', key: 'pptx.action.gotoSlide' },
	{ value: 'firstSlide', key: 'pptx.hyperlink.actionFirstSlide' },
	{ value: 'lastSlide', key: 'pptx.hyperlink.actionLastSlide' },
	{ value: 'prevSlide', key: 'pptx.hyperlink.actionPrevSlide' },
	{ value: 'nextSlide', key: 'pptx.hyperlink.actionNextSlide' },
	{ value: 'endShow', key: 'pptx.hyperlink.actionEndShow' },
];

const clickAction = computed(() =>
	props.element.actionClick
		? pptxActionToElementAction(props.element.actionClick, 'click')
		: undefined,
);
const hoverAction = computed(() =>
	props.element.actionHover
		? pptxActionToElementAction(props.element.actionHover, 'hover')
		: undefined,
);

function actionFor(trigger: 'click' | 'hover'): ElementAction | undefined {
	return trigger === 'click' ? clickAction.value : hoverAction.value;
}

function update(
	trigger: 'click' | 'hover',
	type: ElementActionType,
	url?: string,
	slideIndex?: number,
): void {
	const action = elementActionToPptxAction({ trigger, type, url, slideIndex });
	emit(
		'update',
		(trigger === 'click'
			? { actionClick: action }
			: { actionHover: action }) as Partial<PptxElement>,
	);
}

function onType(event: Event, trigger: 'click' | 'hover'): void {
	const current = actionFor(trigger);
	update(
		trigger,
		(event.target as HTMLSelectElement).value as ElementActionType,
		current?.url,
		current?.slideIndex,
	);
}

function onUrl(event: Event, trigger: 'click' | 'hover'): void {
	update(trigger, 'url', (event.target as HTMLInputElement).value);
}

function onSlide(event: Event, trigger: 'click' | 'hover'): void {
	const value = Number((event.target as HTMLInputElement).value);
	if (Number.isFinite(value)) {
		update(trigger, 'slide', undefined, Math.max(0, value - 1));
	}
}
</script>

<template>
	<div class="pptx-vue-action-settings rounded border border-border bg-card p-2 space-y-2">
		<div class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.action.title') }}
		</div>
		<div v-for="trigger in ['click', 'hover'] as const" :key="trigger" class="space-y-1.5">
			<label class="block text-[11px] font-medium text-muted-foreground">
				{{ t(trigger === 'click' ? 'pptx.action.onClick' : 'pptx.action.onHover') }}
			</label>
			<select
				class="w-full rounded border border-border bg-muted px-1.5 py-1 text-[11px]"
				:disabled="!canEdit"
				:value="actionFor(trigger)?.type ?? 'none'"
				@change="onType($event, trigger)"
			>
				<option v-for="option in OPTIONS" :key="option.value" :value="option.value">
					{{ t(option.key) }}
				</option>
			</select>
			<input
				v-if="actionFor(trigger)?.type === 'url'"
				type="url"
				class="w-full rounded border border-border bg-muted px-1.5 py-1 text-[11px]"
				:disabled="!canEdit"
				:value="actionFor(trigger)?.url ?? ''"
				placeholder="https://..."
				@input="onUrl($event, trigger)"
			/>
			<input
				v-if="actionFor(trigger)?.type === 'slide'"
				type="number"
				class="w-full rounded border border-border bg-muted px-1.5 py-1 text-[11px]"
				:disabled="!canEdit"
				:min="1"
				:max="slideCount"
				:value="(actionFor(trigger)?.slideIndex ?? 0) + 1"
				@change="onSlide($event, trigger)"
			/>
		</div>
	</div>
</template>
