<script setup lang="ts">
import { elementActionToPptxAction, pptxActionToElementAction } from 'pptx-viewer-core';
import type { ElementActionType, PptxAction, PptxElement } from 'pptx-viewer-core';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';

/**
 * HyperlinkDialog: set, change, or clear an element's click action.
 *
 * The action is stored on the element-level `actionClick` field (a
 * `PptxAction`, mirroring the OOXML `ppaction://` scheme). Beyond a plain URL,
 * this dialog also exposes the navigation action verbs (go to a specific slide,
 * first / last / previous / next slide, end show), converting to/from the
 * high-level `ElementAction` shape with the core
 * `pptxActionToElementAction` / `elementActionToPptxAction` helpers, matching
 * the React `ActionSettingsPanel`. A tooltip applies to any action type.
 *
 * Emits a `save` patch shaped as `{ actionClick: PptxAction | undefined }`
 * (undefined clears the action); apply it with `ops.updateElement(id, patch)`.
 */
const props = defineProps<{
	/** Whether the dialog is open. */
	open: boolean;
	/** The element whose action is being edited, or `null`. */
	element: PptxElement | null;
	/** Total slide count, for the "go to slide" number field bounds. */
	slideCount?: number;
}>();

const emit = defineEmits<{
	(e: 'save', patch: Partial<PptxElement>): void;
	(e: 'close'): void;
}>();

const { t } = useI18n();

const ACTION_TYPES: Array<{ value: ElementActionType; labelKey: string }> = [
	{ value: 'none', labelKey: 'pptx.hyperlink.actionNone' },
	{ value: 'url', labelKey: 'pptx.hyperlink.actionUrl' },
	{ value: 'slide', labelKey: 'pptx.hyperlink.actionSlide' },
	{ value: 'firstSlide', labelKey: 'pptx.hyperlink.actionFirstSlide' },
	{ value: 'lastSlide', labelKey: 'pptx.hyperlink.actionLastSlide' },
	{ value: 'prevSlide', labelKey: 'pptx.hyperlink.actionPrevSlide' },
	{ value: 'nextSlide', labelKey: 'pptx.hyperlink.actionNextSlide' },
	{ value: 'endShow', labelKey: 'pptx.hyperlink.actionEndShow' },
];

const actionType = ref<ElementActionType>('url');
const url = ref('');
const tooltip = ref('');
const slideNumber = ref(1);

const hasExistingLink = computed(() => Boolean(props.element?.actionClick));

// Seed the form from the element's current click action each time the dialog
// opens (or the target element changes while open).
watch(
	[() => props.open, () => props.element],
	([isOpen]) => {
		if (!isOpen) {
			return;
		}
		const action = props.element?.actionClick;
		tooltip.value = action?.tooltip ?? '';
		if (action) {
			const ea = pptxActionToElementAction(action, 'click');
			actionType.value = ea.type;
			url.value = ea.type === 'url' ? (ea.url ?? action.url ?? '') : '';
			slideNumber.value =
				ea.type === 'slide' ? (ea.slideIndex ?? action.targetSlideIndex ?? 0) + 1 : 1;
		} else {
			actionType.value = 'url';
			url.value = '';
			slideNumber.value = 1;
		}
	},
	{ immediate: true },
);

function close(): void {
	emit('close');
}

function save(): void {
	if (!props.element) {
		close();
		return;
	}
	if (actionType.value === 'none') {
		emit('save', { actionClick: undefined });
		close();
		return;
	}

	const pptxAction = elementActionToPptxAction({
		trigger: 'click',
		type: actionType.value,
		url: actionType.value === 'url' ? url.value.trim() : undefined,
		slideIndex: actionType.value === 'slide' ? Math.max(0, slideNumber.value - 1) : undefined,
	});

	// A URL action with an empty address clears the link entirely.
	if (!pptxAction || (actionType.value === 'url' && !url.value.trim())) {
		emit('save', { actionClick: undefined });
		close();
		return;
	}

	const trimmedTooltip = tooltip.value.trim();
	const actionClick: PptxAction = {
		...pptxAction,
		tooltip: trimmedTooltip === '' ? undefined : trimmedTooltip,
	};
	emit('save', { actionClick });
	close();
}

function clear(): void {
	actionType.value = 'none';
	url.value = '';
	tooltip.value = '';
	emit('save', { actionClick: undefined });
	close();
}

const inputCls =
	'w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary';
</script>

<template>
	<ModalDialog :open="open" :title="t('pptx.hyperlinkDialog.title')" @close="close">
		<div class="pptx-vue-hyperlink-form flex min-w-[280px] flex-col gap-3">
			<label class="flex flex-col gap-1">
				<span class="text-xs font-medium text-muted-foreground">{{
					t('pptx.hyperlink.linkTo')
				}}</span>
				<select :aria-label="t('pptx.hyperlink.linkTo')" v-model="actionType" :class="inputCls">
					<option v-for="opt in ACTION_TYPES" :key="opt.value" :value="opt.value">
						{{ t(opt.labelKey) }}
					</option>
				</select>
			</label>

			<label v-if="actionType === 'url'" class="flex flex-col gap-1">
				<span class="text-xs font-medium text-muted-foreground">{{
					t('pptx.hyperlink.urlLabel')
				}}</span>
				<input
					v-model="url"
					type="url"
					:class="inputCls"
					:placeholder="t('pptx.hyperlink.urlPlaceholder')"
					@keydown.enter.prevent="save"
				/>
			</label>

			<label v-else-if="actionType === 'slide'" class="flex flex-col gap-1">
				<span class="text-xs font-medium text-muted-foreground">{{
					t('pptx.hyperlink.slideLabel')
				}}</span>
				<input
					v-model.number="slideNumber"
					type="number"
					:min="1"
					:max="props.slideCount ?? undefined"
					:class="inputCls"
					:placeholder="t('pptx.hyperlink.slideLabel')"
					@keydown.enter.prevent="save"
				/>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-xs font-medium text-muted-foreground">{{
					t('pptx.hyperlink.tooltipLabel')
				}}</span>
				<input
					v-model="tooltip"
					type="text"
					:class="inputCls"
					:placeholder="t('pptx.hyperlinkDialog.tooltipPlaceholder')"
					@keydown.enter.prevent="save"
				/>
			</label>
		</div>

		<template #footer>
			<button
				v-if="hasExistingLink"
				type="button"
				class="mr-auto rounded border border-transparent px-3 py-1.5 text-xs text-destructive hover:bg-muted"
				@click="clear"
			>
				{{ t('pptx.hyperlinkDialog.removeLink') }}
			</button>
			<button
				type="button"
				class="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
				@click="close"
			>
				{{ t('pptx.comments.cancel') }}
			</button>
			<button
				type="button"
				class="rounded border border-transparent bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90"
				@click="save"
			>
				{{ t('pptx.hyperlinkDialog.apply') }}
			</button>
		</template>
	</ModalDialog>
</template>
