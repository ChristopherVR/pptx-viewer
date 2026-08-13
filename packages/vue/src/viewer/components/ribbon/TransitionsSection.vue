<script setup lang="ts">
import { Copy, PanelRight, Play } from 'lucide-vue-next';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import type { RibbonTransitionDraft } from 'pptx-viewer-shared';
import {
	playSlideTransitionPreview,
	RIBBON_TRANSITION_PRESETS,
	readRibbonTransitionDraft,
	ribbonTransitionUpdates,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { ic, ics, pill, SEP } from './ribbon-constants';

/**
 * TransitionsSection: the Transitions ribbon tab.
 *
 * This used to be a line-for-line port of React's mock version: five local
 * `ref`s, no emits, and an Apply-to-All button with no handler, so a Vue user
 * could not author a slide transition from anywhere in the product (the
 * inspector equivalent was dead code at the same time). Every control now reads
 * the ACTIVE SLIDE through the shared `readRibbonTransitionDraft` and commits
 * through `ribbonTransitionUpdates`, which is the same decision function the
 * other four bindings use.
 */
interface Props {
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
	canEdit?: boolean;
	/** The slide whose transition the tab reads and writes. */
	activeSlide?: PptxSlide;
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
	onApplyTransitionToAll: () => void;
}

// `withDefaults` is load-bearing: Vue casts an ABSENT boolean prop to `false`,
// so a bare `defineProps` would leave `canEdit` false whenever a caller omits
// it and silently disable every control on the tab.
const props = withDefaults(defineProps<Props>(), { canEdit: true, activeSlide: undefined });

const { t } = useI18n();

const presets = RIBBON_TRANSITION_PRESETS;
const draft = computed(() => readRibbonTransitionDraft(props.activeSlide));
// NOT named `canEdit`: that is also a prop name, and a template reference would
// then be ambiguous between the prop and this computed.
const editable = computed(() => props.canEdit);

// Each text field shows the model's value EXCEPT while it is being typed into,
// so a half-typed "1." is not immediately reformatted back at the user.
const durationBuffer = ref<string | null>(null);
const advanceBuffer = ref<string | null>(null);

function commit(changes: Partial<RibbonTransitionDraft>): void {
	props.onTransitionChange(ribbonTransitionUpdates({ ...draft.value, ...changes }));
}

/**
 * Replay the slide's own transition ON THE STAGE, without touching the deck.
 * This used to re-commit the transition, which writes back the values the slide
 * already had: an edit the user cannot see and a spec cannot tell from a no-op.
 */
function preview(): void {
	playSlideTransitionPreview(props.activeSlide?.transition, document);
}

function onDurationInput(event: Event): void {
	const raw = (event.target as HTMLInputElement).value;
	durationBuffer.value = raw;
	const seconds = Number(raw);
	if (raw !== '' && Number.isFinite(seconds)) {
		commit({ durationSec: seconds });
	}
}

function onAdvanceTextInput(event: Event): void {
	const raw = (event.target as HTMLInputElement).value;
	advanceBuffer.value = raw;
	commit({ advanceAfter: true, advanceAfterText: raw });
}
</script>

<template>
	<!-- Preview -->
	<button
		type="button"
		:class="pill"
		:title="t('pptx.ribbon.previewTransition')"
		@click="preview()"
	>
		<Play :class="ics" />
		{{ t('pptx.ribbon.preview') }}
	</button>

	<div :class="SEP" />

	<!-- Transition preset gallery -->
	<div class="inline-flex items-center gap-0.5 overflow-x-auto max-w-[420px]">
		<button
			v-for="preset in presets"
			:key="preset.type"
			type="button"
			:disabled="!editable"
			:class="
				cn(
					'flex-shrink-0 px-2 py-1 max-md:min-h-[44px] rounded border text-[11px] leading-tight transition-colors',
					draft.type === preset.type
						? 'border-primary bg-primary/10 text-primary font-medium'
						: 'border-border bg-muted hover:bg-accent text-foreground',
				)
			"
			:title="t('pptx.ribbon.transitionTitle', { name: t(preset.labelKey) })"
			@click="commit({ type: preset.type })"
		>
			{{ t(preset.labelKey) }}
		</button>
	</div>

	<div :class="SEP" />

	<!-- Duration -->
	<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
		<span class="whitespace-nowrap">{{ t('pptx.ribbon.duration') }}</span>
		<input
			type="number"
			min="0"
			max="20"
			step="0.25"
			:disabled="!editable"
			:value="durationBuffer ?? String(draft.durationSec)"
			class="w-16 px-1.5 py-1 rounded border border-border bg-muted text-xs text-foreground text-center"
			:title="t('pptx.ribbon.transitionDurationTitle')"
			@input="onDurationInput"
			@blur="durationBuffer = null"
		/>
	</label>

	<div :class="SEP" />

	<!-- Sound: no binding can author a transition sound, so the control that
	     cannot work renders disabled instead of pretending. -->
	<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
		<span class="whitespace-nowrap">{{ t('pptx.ribbon.sound') }}</span>
		<select
			disabled
			class="w-24 px-1.5 py-1 rounded border border-border bg-muted text-xs text-foreground disabled:opacity-50"
		>
			<option value="none">{{ t('pptx.ribbon.soundNone') }}</option>
		</select>
	</label>

	<div :class="SEP" />

	<!-- Apply to All -->
	<button
		type="button"
		:disabled="!editable"
		:class="pill"
		:title="t('pptx.ribbon.applyTransitionToAll')"
		@click="props.onApplyTransitionToAll()"
	>
		<Copy :class="ics" />
		{{ t('pptx.headerFooter.applyToAll') }}
	</button>

	<div :class="SEP" />

	<!-- Advance Slide group -->
	<div class="inline-flex flex-col gap-1 text-xs text-muted-foreground">
		<span class="text-[10px] font-medium text-foreground">{{ t('pptx.ribbon.advanceSlide') }}</span>
		<label class="inline-flex items-center gap-1.5 cursor-pointer">
			<input
				type="checkbox"
				:disabled="!editable"
				:checked="draft.advanceOnClick"
				class="accent-primary h-3 w-3"
				@change="commit({ advanceOnClick: ($event.target as HTMLInputElement).checked })"
			/>
			<span class="whitespace-nowrap">{{ t('pptx.ribbon.onMouseClick') }}</span>
		</label>
		<label class="inline-flex items-center gap-1.5 cursor-pointer">
			<input
				type="checkbox"
				:disabled="!editable"
				:checked="draft.advanceAfter"
				class="accent-primary h-3 w-3"
				@change="commit({ advanceAfter: ($event.target as HTMLInputElement).checked })"
			/>
			<span class="whitespace-nowrap">{{ t('pptx.ribbon.afterDuration') }}</span>
			<input
				type="text"
				:value="advanceBuffer ?? draft.advanceAfterText"
				:disabled="!editable || !draft.advanceAfter"
				class="w-16 px-1 py-0.5 rounded border border-border bg-muted text-xs text-foreground text-center disabled:opacity-50"
				:title="t('pptx.ribbon.advanceAfterSeconds')"
				@input="onAdvanceTextInput"
				@blur="advanceBuffer = null"
			/>
		</label>
	</div>

	<div :class="SEP" />

	<!-- Inspector -->
	<button
		type="button"
		:class="cn(pill, props.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.ribbon.openInspectorTransitions')"
		@click="props.onToggleInspector()"
	>
		<PanelRight :class="ic" />
		{{ t('pptx.ribbon.inspector') }}
	</button>
</template>
