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
import { onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSheetDismissDrag } from '../composables/useSheetDismissDrag';

const { t } = useI18n();

const props = defineProps<{ open: boolean; title?: string }>();
const emit = defineEmits<{ close: [] }>();

const { dragY, dragging, onPointerDown, onPointerMove, onPointerUp } = useSheetDismissDrag(() =>
	emit('close'),
);

function onKey(e: KeyboardEvent): void {
	if (props.open && e.key === 'Escape') {
		emit('close');
	}
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
	<div
		v-if="open"
		class="pptx-vue-msheet fixed inset-0 z-[60] flex flex-col justify-end"
		role="dialog"
		aria-modal="true"
	>
		<!-- Backdrop -->
		<button
			type="button"
			:aria-label="t('pptx.settings.close')"
			class="absolute inset-0 border-0 bg-black/40 backdrop-blur-[2px]"
			@click="emit('close')"
		/>

		<!-- Panel -->
		<div
			class="pptx-vue-msheet-panel relative flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-card text-foreground shadow-2xl"
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
