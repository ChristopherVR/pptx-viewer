<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';

/**
 * ModalDialog — a reusable, accessible modal dialog for the Vue viewer.
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
 * The component is presentational — the parent owns the `open` flag and
 * decides what `close` means (typically setting `open` back to `false`).
 */
const props = defineProps<{
	/** Whether the dialog is visible. */
	open: boolean;
	/** Optional heading shown in the header bar. */
	title?: string;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
}>();

function requestClose(): void {
	emit('close');
}

/** Close on `Escape`, regardless of where focus currently sits. */
function onKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') {
		event.stopPropagation();
		requestClose();
	}
}

/**
 * Backdrop clicks close the dialog, but clicks that bubble up from the panel
 * must not — the panel stops propagation in the template, so this handler only
 * ever fires for the backdrop itself.
 */
function onBackdropClick(): void {
	requestClose();
}

watch(
	() => props.open,
	(isOpen) => {
		if (typeof document === 'undefined') {
			return;
		}
		if (isOpen) {
			document.addEventListener('keydown', onKeydown);
		} else {
			document.removeEventListener('keydown', onKeydown);
		}
	},
	{ immediate: true },
);

onBeforeUnmount(() => {
	if (typeof document !== 'undefined') {
		document.removeEventListener('keydown', onKeydown);
	}
});
</script>

<template>
	<Teleport to="body">
		<div
			v-if="open"
			class="pptx-vue-modal-backdrop fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
			@click="onBackdropClick"
		>
			<div
				class="pptx-vue-modal-panel flex max-h-[88vh] min-w-[320px] max-w-[min(92vw,480px)] flex-col overflow-hidden rounded-lg border border-border bg-popover text-foreground shadow-2xl"
				role="dialog"
				aria-modal="true"
				:aria-label="title"
				@click.stop
			>
				<header
					class="pptx-vue-modal-header flex items-center justify-between gap-3 border-b border-border px-4 py-3"
				>
					<h2 v-if="title" class="pptx-vue-modal-title text-sm font-semibold leading-snug">
						{{ title }}
					</h2>
					<span v-else />
					<button
						type="button"
						class="pptx-vue-modal-close inline-flex h-6 w-6 items-center justify-center rounded text-lg leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close"
						@click="requestClose"
					>
						&times;
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
