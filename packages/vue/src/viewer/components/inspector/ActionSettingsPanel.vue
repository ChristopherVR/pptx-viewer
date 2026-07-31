<script setup lang="ts">
/**
 * ActionSettingsPanel: PowerPoint's Insert > Action dialog as an inspector
 * card, at parity with React's `inspector/ActionSettingsPanel.tsx`.
 *
 * An element carries two independent actions, one per trigger (`actionClick` /
 * `actionHover`), stored as the OOXML-shaped `PptxAction`; core's
 * `pptxActionToElementAction` / `elementActionToPptxAction` convert both ways so
 * this panel never hand-rolls a `ppaction://` URI. The option catalogue, the
 * pending-type rule and the 1-based to 0-based slide-number clamp all come from
 * `pptx-viewer-shared`, so a new action kind reaches every binding at once.
 */
import type { ElementAction, ElementActionType, PptxElement } from 'pptx-viewer-core';
import { elementActionToPptxAction, pptxActionToElementAction } from 'pptx-viewer-core';
import {
	canCommitActionType,
	ELEMENT_ACTION_TYPE_OPTIONS,
	resolveActionType,
	toSlideIndex,
} from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

type Trigger = 'click' | 'hover';

const props = withDefaults(
	defineProps<{ element: PptxElement; slideCount?: number; canEdit?: boolean }>(),
	{ slideCount: 0, canEdit: true },
);
const emit = defineEmits<{ update: [patch: Partial<PptxElement>] }>();
const { t } = useI18n();

const triggers: readonly Trigger[] = ['click', 'hover'];

/**
 * The type the user just picked, per trigger.
 *
 * WHY it exists: "Go to URL" / "Go to Slide" only become a stored action once
 * they carry a target, so a select driven purely by the committed element
 * snapped straight back to "None" and the input needed to supply that target
 * never rendered, leaving both kinds unreachable.
 */
const pendingType = ref<Partial<Record<Trigger, ElementActionType>>>({});

// A pending pick belongs to the element it was made on, so drop it when the
// inspector moves to another element; otherwise the next shape would inherit a
// phantom "Go to URL" it never had.
watch(
	() => props.element.id,
	() => {
		pendingType.value = {};
	},
);

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

function actionFor(trigger: Trigger): ElementAction | undefined {
	return trigger === 'click' ? clickAction.value : hoverAction.value;
}

/** The action type the trigger's controls should render right now. */
function typeFor(trigger: Trigger): ElementActionType {
	return resolveActionType(pendingType.value[trigger], actionFor(trigger)?.type);
}

function update(
	trigger: Trigger,
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

function onType(event: Event, trigger: Trigger): void {
	const type = (event.target as HTMLSelectElement).value as ElementActionType;
	pendingType.value = { ...pendingType.value, [trigger]: type };
	const current = actionFor(trigger);
	const target = { url: current?.url, slideIndex: current?.slideIndex };
	if (canCommitActionType(type, target)) {
		update(trigger, type, target.url, target.slideIndex);
	}
}

function onUrl(event: Event, trigger: Trigger): void {
	update(trigger, 'url', (event.target as HTMLInputElement).value);
}

function onSlide(event: Event, trigger: Trigger): void {
	const index = toSlideIndex(Number((event.target as HTMLInputElement).value), props.slideCount);
	if (index !== undefined) {
		update(trigger, 'slide', undefined, index);
	}
}
</script>

<template>
	<div class="pptx-vue-action-settings rounded border border-border bg-card p-2 space-y-2">
		<div class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.action.title') }}
		</div>
		<div v-for="trigger in triggers" :key="trigger" class="space-y-1.5">
			<label class="block text-[11px] font-medium text-muted-foreground">
				{{ t(trigger === 'click' ? 'pptx.action.onClick' : 'pptx.action.onHover') }}
			</label>
			<select
				class="w-full rounded border border-border bg-muted px-1.5 py-1 text-[11px]"
				:aria-label="t(trigger === 'click' ? 'pptx.action.onClick' : 'pptx.action.onHover')"
				:disabled="!canEdit"
				:value="typeFor(trigger)"
				@change="onType($event, trigger)"
			>
				<option
					v-for="option in ELEMENT_ACTION_TYPE_OPTIONS"
					:key="option.value"
					:value="option.value"
				>
					{{ t(option.labelKey) }}
				</option>
			</select>
			<input
				v-if="typeFor(trigger) === 'url'"
				type="url"
				class="w-full rounded border border-border bg-muted px-1.5 py-1 text-[11px]"
				:aria-label="t('pptx.action.gotoUrl')"
				:disabled="!canEdit"
				:value="actionFor(trigger)?.url ?? ''"
				placeholder="https://..."
				@input="onUrl($event, trigger)"
			/>
			<input
				v-if="typeFor(trigger) === 'slide'"
				type="number"
				class="w-full rounded border border-border bg-muted px-1.5 py-1 text-[11px]"
				:aria-label="t('pptx.action.gotoSlide')"
				:disabled="!canEdit"
				:min="1"
				:max="slideCount"
				:value="(actionFor(trigger)?.slideIndex ?? 0) + 1"
				@change="onSlide($event, trigger)"
			/>
		</div>
	</div>
</template>
