<script setup lang="ts">
/**
 * MobileSheet - reusable slide-up bottom sheet for the Vue `pptx-vue-viewer`.
 *
 * Vue port of `packages/react/src/viewer/components/mobile/MobileSheet.tsx`:
 *   - a tap-to-close backdrop,
 *   - a rounded-top panel that animates up from the bottom,
 *   - a handle + header that form one swipe-to-dismiss grab region
 *     (drag down past the threshold to close),
 *   - Escape closes the sheet.
 *
 * Visibility is owned by the parent (`v-if="isMobile && open"`); the body is
 * scrollable and sized via dvh so it survives the mobile address-bar collapse.
 */
import { activateModalFocus } from 'pptx-viewer-shared';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSheetDismissDrag } from '../composables/useSheetDismissDrag';

const { t } = useI18n();

const props = defineProps<{ open: boolean; title?: string; inspector?: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { dragY, dragging, onPointerDown, onPointerMove, onPointerUp } = useSheetDismissDrag(() =>
	emit('close'),
);

const panelRef = ref<HTMLElement | null>(null);
let releaseFocus: (() => void) | undefined;
watch(
	() => props.open,
	async (open) => {
		releaseFocus?.();
		releaseFocus = undefined;
		if (open) {
			await nextTick();
			if (panelRef.value) {
				releaseFocus = activateModalFocus(panelRef.value, { onEscape: () => emit('close') });
			}
		}
	},
	{ immediate: true },
);
onBeforeUnmount(() => releaseFocus?.());
</script>

<template>
	<div v-if="open" class="pptx-vue-msheet fixed inset-0 z-[60] flex flex-col justify-end">
		<!-- Backdrop -->
		<button
			type="button"
			:aria-label="t('pptx.settings.close')"
			class="absolute inset-0 border-0 bg-black/40 backdrop-blur-[2px]"
			@click="emit('close')"
		/>

		<!-- Panel -->
		<div
			ref="panelRef"
			class="pptx-vue-msheet-panel relative flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-card text-foreground shadow-2xl"
			role="dialog"
			aria-modal="true"
			:aria-label="title || t('pptx.mobileSheet.ariaLabel')"
			tabindex="-1"
			:data-pptx-inspector="props.inspector ? '' : undefined"
			:style="{
				transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
				transition: dragging ? 'none' : 'transform 150ms ease-out',
			}"
		>
			<!-- Handle + header = one swipe-to-dismiss grab region -->
			<div
				class="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
				@pointerdown="onPointerDown"
				@pointermove="onPointerMove"
				@pointerup="onPointerUp"
				@pointercancel="onPointerUp"
			>
				<div class="flex items-center justify-center pt-2 pb-1">
					<div class="h-1 w-10 rounded-full bg-muted-foreground/40" />
				</div>
				<div
					v-if="title"
					class="flex items-center justify-between gap-2 border-b border-border/60 px-4 pb-2"
				>
					<span class="truncate text-sm font-semibold text-foreground">{{ title }}</span>
					<button
						type="button"
						class="inline-flex h-8 w-8 items-center justify-center rounded text-xl text-muted-foreground hover:bg-accent hover:text-foreground"
						:aria-label="t('pptx.settings.close')"
						@pointerdown.stop
						@click="emit('close')"
					>
						&times;
					</button>
				</div>
			</div>

			<!-- Scrollable body -->
			<div
				class="flex-1 overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),0px)]"
			>
				<slot />
			</div>
		</div>
	</div>
</template>
