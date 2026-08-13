<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { activateModalFocus } from 'pptx-viewer-shared';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSheetDismissDrag } from '../composables/useSheetDismissDrag';

/**
 * ModalDialog - a reusable, accessible modal dialog for the Vue viewer.
 *
 * Vue counterpart of the React package's ad-hoc dialog shells (e.g.
 * `HyperlinkEditDialog.tsx`), factored into a single reusable component.
 *
 * Behaviour:
 *  - Teleports its markup to `<body>` so it escapes the slide-stage transform
 *    and overflow contexts.
 *  - Renders a full-screen backdrop plus a centered panel with a header
 *    (title + close `×`), a default `<slot>` for the body, and a `footer`
 *    slot for action buttons.
 *  - Emits `close` on backdrop click, on the `×` button, and on `Escape`.
 *
 * The component is presentational: the parent owns the `open` flag and
 * decides what `close` means (typically setting `open` back to `false`).
 */
const props = defineProps<{
	/** Whether the dialog is visible. */
	open: boolean;
	/** Optional heading shown in the header bar. */
	title?: string;
	/**
	 * A `data-*` attribute name to stamp on the panel, e.g.
	 * `data-pptx-autosave-recovery`.
	 *
	 * This exists because the component's root is a `<Teleport>`, so a plain
	 * fallthrough attribute written at the call site is silently dropped instead
	 * of landing on the dialog. Framework-neutral e2e specs identify a dialog by
	 * exactly such a marker, and "silently dropped" is how a binding ends up
	 * being the only one a shared spec cannot see.
	 */
	markerAttr?: string;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
}>();

const { t } = useI18n();

function requestClose(): void {
	emit('close');
}

// Swipe-down-to-dismiss for touch users — drag the header down past the
// threshold to close. The drag is wired through the same composable the mobile
// sheets use so the gesture feels identical.
const { dragY, dragging, onPointerDown, onPointerMove, onPointerUp } =
	useSheetDismissDrag(requestClose);

/**
 * Only start a header drag for touch/pen, and never when the gesture begins on
 * an interactive control (the × button, form fields), so clicks/taps and a
 * desktop mouse are entirely unaffected.
 */
function onHeaderPointerDown(event: PointerEvent): void {
	if (event.pointerType === 'mouse') {
		return;
	}
	if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) {
		return;
	}
	onPointerDown(event);
}

const panelRef = ref<HTMLElement | null>(null);
let releaseFocus: (() => void) | undefined;

function onDocumentKeydown(event: KeyboardEvent): void {
	if (props.open && !releaseFocus && event.key === 'Escape') {
		event.preventDefault();
		requestClose();
	}
}

/**
 * Backdrop clicks close the dialog, but clicks that bubble up from the panel
 * must not; the panel stops propagation in the template, so this handler only
 * ever fires for the backdrop itself.
 */
function onBackdropClick(): void {
	requestClose();
}

watch(
	() => props.open,
	async (isOpen) => {
		releaseFocus?.();
		releaseFocus = undefined;
		if (isOpen) {
			await nextTick();
			if (panelRef.value) {
				releaseFocus = activateModalFocus(panelRef.value, { onEscape: requestClose });
			}
		}
	},
	{ immediate: true },
);

onBeforeUnmount(() => {
	releaseFocus?.();
	document.removeEventListener('keydown', onDocumentKeydown);
});
onMounted(() => document.addEventListener('keydown', onDocumentKeydown));
</script>

<template>
	<Teleport to="body">
		<div
			v-if="open"
			class="pptx-vue-modal-backdrop fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
			@click="onBackdropClick"
		>
			<div
				ref="panelRef"
				class="pptx-vue-modal-panel flex max-h-[88vh] min-w-[320px] max-w-[min(92vw,480px)] flex-col overflow-hidden overscroll-contain rounded-lg border border-border bg-popover text-foreground shadow-2xl max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:min-w-0 max-md:max-w-none max-md:max-h-[88dvh] max-md:rounded-b-none max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]"
				role="dialog"
				aria-modal="true"
				v-bind="props.markerAttr ? { [props.markerAttr]: 'true' } : {}"
				:aria-label="title"
				tabindex="-1"
				:style="{
					transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
					transition: dragging ? 'none' : 'transform 150ms ease-out',
				}"
				@click.stop
			>
				<header
					class="pptx-vue-modal-header flex touch-none items-center justify-between gap-3 border-b border-border px-4 py-3"
					@pointerdown="onHeaderPointerDown"
					@pointermove="onPointerMove"
					@pointerup="onPointerUp"
					@pointercancel="onPointerUp"
				>
					<h2 v-if="title" class="pptx-vue-modal-title text-sm font-semibold leading-snug">
						{{ title }}
					</h2>
					<span v-else />
					<button
						type="button"
						class="pptx-vue-modal-close inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground max-md:h-11 max-md:w-11"
						:aria-label="t('pptx.settings.close')"
						@click="requestClose"
					>
						<X class="h-4 w-4 max-md:h-6 max-md:w-6" aria-hidden="true" />
					</button>
				</header>

				<div class="pptx-vue-modal-body overflow-y-auto p-4">
					<slot />
				</div>

				<footer
					v-if="$slots.footer"
					class="pptx-vue-modal-footer flex justify-end gap-2 border-t border-border px-4 py-3"
				>
					<slot name="footer" />
				</footer>
			</div>
		</div>
	</Teleport>
</template>
