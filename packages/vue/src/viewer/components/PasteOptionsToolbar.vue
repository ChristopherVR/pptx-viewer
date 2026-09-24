<script setup lang="ts">
/**
 * PasteOptionsToolbar: the small icon-strip PowerPoint anchors to the
 * bottom-right corner of a just-pasted element, offering the same four
 * formats as the Paste Special dialog as a one-click follow-up. Dismissed by
 * any subsequent pointerdown or keydown. Vue port of the React
 * `PasteOptionsToolbar.tsx`.
 */
import type { PasteSpecialFormat } from 'pptx-viewer-shared';
import { PASTE_SPECIAL_OPTIONS } from 'pptx-viewer-shared';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
	/** The just-pasted element's id, or null when the toolbar should be hidden. */
	elementId: string | null;
}>();

const emit = defineEmits<{
	choose: [format: PasteSpecialFormat];
	dismiss: [];
}>();

const rect = ref<{ left: number; top: number } | null>(null);

function measure(): void {
	const id = props.elementId;
	if (!id) {
		rect.value = null;
		return;
	}
	const node = document.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
	if (!node) {
		rect.value = null;
		return;
	}
	const box = node.getBoundingClientRect();
	rect.value = { left: box.right, top: box.bottom };
}

function onOutsideEvent(): void {
	emit('dismiss');
}

function addListeners(): void {
	window.addEventListener('pointerdown', onOutsideEvent, true);
	window.addEventListener('keydown', onOutsideEvent, true);
}
function removeListeners(): void {
	window.removeEventListener('pointerdown', onOutsideEvent, true);
	window.removeEventListener('keydown', onOutsideEvent, true);
}

watch(
	() => props.elementId,
	async (id) => {
		removeListeners();
		if (!id) {
			rect.value = null;
			return;
		}
		await nextTick();
		measure();
		// Deferred so the paste action's OWN pointerdown/keydown does not
		// immediately dismiss the toolbar it just opened.
		window.setTimeout(addListeners, 0);
	},
	{ immediate: true },
);

onBeforeUnmount(removeListeners);
</script>

<template>
	<div
		v-if="props.elementId && rect"
		role="toolbar"
		tabindex="-1"
		:aria-label="t('pptx.pasteSpecial.optionsLabel')"
		data-pptx-paste-options
		class="fixed z-[1100] flex items-center gap-0.5 rounded border border-border bg-popover p-1 shadow-lg"
		:style="{ left: `${rect.left + 4}px`, top: `${rect.top + 4}px` }"
		@mousedown.stop
	>
		<button
			v-for="option in PASTE_SPECIAL_OPTIONS"
			:key="option.id"
			type="button"
			:title="t(option.labelKey)"
			:aria-label="t(option.labelKey)"
			class="whitespace-nowrap rounded px-2 py-1 text-[11px] text-foreground hover:bg-accent"
			@click="emit('choose', option.id)"
		>
			{{ t(option.labelKey) }}
		</button>
	</div>
</template>
