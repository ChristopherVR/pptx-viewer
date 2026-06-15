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
		<div v-if="open" class="pptx-vue-modal-backdrop" @click="onBackdropClick">
			<div
				class="pptx-vue-modal-panel"
				role="dialog"
				aria-modal="true"
				:aria-label="title"
				@click.stop
			>
				<header class="pptx-vue-modal-header">
					<h2 v-if="title" class="pptx-vue-modal-title">{{ title }}</h2>
					<span v-else />
					<button
						type="button"
						class="pptx-vue-modal-close"
						aria-label="Close"
						@click="requestClose"
					>
						&times;
					</button>
				</header>

				<div class="pptx-vue-modal-body">
					<slot />
				</div>

				<footer v-if="$slots.footer" class="pptx-vue-modal-footer">
					<slot name="footer" />
				</footer>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.pptx-vue-modal-backdrop {
	position: fixed;
	inset: 0;
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.45);
}

.pptx-vue-modal-panel {
	display: flex;
	flex-direction: column;
	min-width: 320px;
	max-width: min(92vw, 480px);
	max-height: 88vh;
	overflow: hidden;
	background: var(--pptx-vue-popover, #ffffff);
	color: var(--pptx-vue-foreground, #111827);
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: var(--pptx-vue-radius, 8px);
	box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
}

.pptx-vue-modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 16px;
	border-bottom: 1px solid var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-modal-title {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	line-height: 1.4;
}

.pptx-vue-modal-close {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	padding: 0;
	font-size: 18px;
	line-height: 1;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	background: transparent;
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-modal-close:hover {
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-muted, #f3f4f6);
}

.pptx-vue-modal-body {
	padding: 16px;
	overflow-y: auto;
}

.pptx-vue-modal-footer {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	padding: 12px 16px;
	border-top: 1px solid var(--pptx-vue-border, #e5e7eb);
}
</style>
