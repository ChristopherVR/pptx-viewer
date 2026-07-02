<script setup lang="ts">
import type { PptxCustomShow, PptxPresentationProperties } from 'pptx-viewer-core';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';
import ShowOptionsFieldset from './ShowOptionsFieldset.vue';
import ShowSlidesFieldset from './ShowSlidesFieldset.vue';

/**
 * SetUpSlideShowDialog: configure slide-show playback settings (show type,
 * slide range, advance mode, loop / narration / animation / subtitles, and the
 * annotation pen colour). Vue port of the React `SetUpSlideShowDialog.tsx`.
 *
 * The dialog edits a local `draft` copy of the presentation properties and
 * only commits it via the `save` event on OK, so cancelling discards edits.
 * The host persists the returned properties through the editor/save path.
 */
const props = defineProps<{
	open: boolean;
	properties: PptxPresentationProperties;
	customShows: PptxCustomShow[];
	slideCount: number;
}>();

const emit = defineEmits<{
	save: [properties: PptxPresentationProperties];
	close: [];
}>();

const { t } = useI18n();

const draft = ref<PptxPresentationProperties>({ ...props.properties });

// Re-seed the draft each time the dialog opens so it reflects the latest saved
// properties and drops any abandoned edits from a previous cancel.
watch(
	() => props.open,
	(open) => {
		if (open) {
			draft.value = { ...props.properties };
		}
	},
	{ immediate: true },
);

const showType = computed(() => draft.value.showType ?? 'presented');
const showSlidesMode = computed(() => draft.value.showSlidesMode ?? 'all');

function update(patch: Partial<PptxPresentationProperties>): void {
	draft.value = { ...draft.value, ...patch };
}

function setShowType(value: 'presented' | 'browsed' | 'kiosk'): void {
	update({ showType: value, ...(value === 'kiosk' ? { loopContinuously: true } : {}) });
}

function onSave(): void {
	emit('save', { ...draft.value });
	emit('close');
}

const showTypes = computed<Array<['presented' | 'browsed' | 'kiosk', string]>>(() => [
	['presented', t('pptx.slideShow.typePresented')],
	['browsed', t('pptx.slideShow.typeBrowsed')],
	['kiosk', t('pptx.slideShow.typeKiosk')],
]);
</script>

<template>
	<ModalDialog :open="props.open" :title="t('pptx.slideShow.title')" @close="emit('close')">
		<div class="flex flex-col gap-5 text-[12px] text-foreground">
			<fieldset class="space-y-1.5">
				<legend class="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
					{{ t('pptx.slideShow.legendShowType') }}
				</legend>
				<label
					v-for="[value, label] in showTypes"
					:key="value"
					class="flex cursor-pointer items-center gap-2"
				>
					<input
						type="radio"
						name="showType"
						class="accent-primary"
						:value="value"
						:checked="showType === value"
						@change="setShowType(value)"
					/>
					<span>{{ label }}</span>
				</label>
			</fieldset>

			<ShowSlidesFieldset
				:draft="draft"
				:show-slides-mode="showSlidesMode"
				:slide-count="props.slideCount"
				:custom-shows="props.customShows"
				@update="update"
			/>

			<fieldset class="space-y-1.5">
				<legend class="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
					{{ t('pptx.slideShow.legendAdvance') }}
				</legend>
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="radio"
						name="advanceMode"
						value="manual"
						class="accent-primary"
						:checked="(draft.advanceMode ?? 'manual') === 'manual'"
						@change="update({ advanceMode: 'manual' })"
					/>
					<span>{{ t('pptx.slideShow.advanceManual') }}</span>
				</label>
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="radio"
						name="advanceMode"
						value="useTimings"
						class="accent-primary"
						:checked="draft.advanceMode === 'useTimings'"
						@change="update({ advanceMode: 'useTimings' })"
					/>
					<span>{{ t('pptx.slideShow.advanceTimings') }}</span>
				</label>
			</fieldset>

			<ShowOptionsFieldset :draft="draft" @update="update" />
		</div>

		<template #footer>
			<button
				type="button"
				class="rounded bg-muted px-3 py-1.5 text-[12px] text-foreground transition-colors hover:bg-accent"
				@click="emit('close')"
			>
				{{ t('pptx.share.cancel') }}
			</button>
			<button
				type="button"
				class="rounded bg-primary px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-primary/80"
				@click="onSave"
			>
				{{ t('pptx.slideShow.ok') }}
			</button>
		</template>
	</ModalDialog>
</template>
