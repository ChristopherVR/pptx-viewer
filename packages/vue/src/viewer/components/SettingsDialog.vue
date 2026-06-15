<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import ModalDialog from './ModalDialog.vue';
import type { ViewerSettings } from './viewer-settings';
import { SETTING_TOGGLES, SHORTCUT_REFERENCE_ITEMS } from './viewer-settings';

/**
 * SettingsDialog — viewer/editor preferences on a tabbed `ModalDialog`.
 *
 * Vue counterpart of the React package's `SettingsDialog.tsx`. It exposes the
 * same boolean preferences (autosave, spell-check, show-grid, show-rulers,
 * snap-to-grid, reduced-motion) on a "General" tab, plus a read-only keyboard
 * "Shortcuts" reference tab.
 *
 * Where the React dialog threaded each setting through its own prop/callback
 * (and kept `autoSave` as dialog-local state), the Vue port takes the whole
 * `ViewerSettings` object as one `settings` prop and emits a single
 * `update(settings)` with the full next value whenever a toggle flips. The host
 * owns persistence; this component is purely presentational.
 *
 * The form is seeded from `settings` each time the dialog opens, so a host can
 * pass a live reactive object or re-feed it on every open — both work.
 */
const props = defineProps<{
	/** Whether the dialog is visible. */
	open: boolean;
	/** Current viewer settings. */
	settings: ViewerSettings;
}>();

const emit = defineEmits<{
	/** Emitted with the full next settings object when any toggle changes. */
	(e: 'update', settings: ViewerSettings): void;
	/** Emitted when the dialog should close. */
	(e: 'close'): void;
}>();

type SettingsTab = 'general' | 'shortcuts';

const activeTab = ref<SettingsTab>('general');

/** Local working copy, re-seeded from `settings` on open. */
const draft = ref<ViewerSettings>({ ...props.settings });

watch(
	[() => props.open, () => props.settings],
	([isOpen]) => {
		if (isOpen) {
			draft.value = { ...props.settings };
		}
	},
	{ immediate: true },
);

const toggles = SETTING_TOGGLES;
const shortcuts = SHORTCUT_REFERENCE_ITEMS;

const tabs = computed<Array<{ id: SettingsTab; label: string }>>(() => [
	{ id: 'general', label: 'General' },
	{ id: 'shortcuts', label: 'Keyboard shortcuts' },
]);

function toggle(key: keyof ViewerSettings): void {
	const next: ViewerSettings = { ...draft.value, [key]: !draft.value[key] };
	draft.value = next;
	emit('update', next);
}

function close(): void {
	emit('close');
}
</script>

<template>
	<ModalDialog :open="open" title="Settings" @close="close">
		<div class="pptx-vue-settings">
			<div class="pptx-vue-settings-tabs" role="tablist">
				<button
					v-for="tab in tabs"
					:key="tab.id"
					type="button"
					role="tab"
					:aria-selected="activeTab === tab.id"
					class="pptx-vue-settings-tab"
					:class="{ 'pptx-vue-settings-tab--active': activeTab === tab.id }"
					@click="activeTab = tab.id"
				>
					{{ tab.label }}
				</button>
			</div>

			<div v-if="activeTab === 'general'" class="pptx-vue-settings-panel">
				<div v-for="spec in toggles" :key="spec.key" class="pptx-vue-settings-row">
					<span class="pptx-vue-settings-row-label">{{ spec.label }}</span>
					<button
						type="button"
						role="switch"
						:aria-checked="draft[spec.key]"
						:aria-label="spec.label"
						class="pptx-vue-settings-switch"
						:class="{ 'pptx-vue-settings-switch--on': draft[spec.key] }"
						@click="toggle(spec.key)"
					>
						<span class="pptx-vue-settings-switch-knob" />
					</button>
				</div>
			</div>

			<div v-else class="pptx-vue-settings-panel">
				<div
					v-for="(item, i) in shortcuts"
					:key="item.action"
					class="pptx-vue-settings-shortcut"
					:class="{ 'pptx-vue-settings-shortcut--alt': i % 2 === 0 }"
				>
					<span class="pptx-vue-settings-shortcut-action">{{ item.action }}</span>
					<span class="pptx-vue-settings-shortcut-keys">{{ item.shortcut }}</span>
				</div>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="pptx-vue-settings-btn pptx-vue-settings-btn--primary"
				@click="close"
			>
				Done
			</button>
		</template>
	</ModalDialog>
</template>

<style scoped>
.pptx-vue-settings {
	display: flex;
	flex-direction: column;
	min-width: 320px;
}

.pptx-vue-settings-tabs {
	display: flex;
	gap: 4px;
	margin-bottom: 8px;
	border-bottom: 1px solid var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-settings-tab {
	position: relative;
	padding: 6px 10px;
	font-size: 12px;
	font-weight: 500;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	background: transparent;
	border: none;
	border-bottom: 2px solid transparent;
	cursor: pointer;
}

.pptx-vue-settings-tab--active {
	color: var(--pptx-vue-primary, #2563eb);
	border-bottom-color: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-settings-panel {
	display: flex;
	flex-direction: column;
	max-height: 56vh;
	overflow-y: auto;
}

.pptx-vue-settings-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 8px 4px;
}

.pptx-vue-settings-row-label {
	font-size: 13px;
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-settings-switch {
	position: relative;
	display: inline-flex;
	align-items: center;
	width: 36px;
	height: 20px;
	padding: 0;
	background: var(--pptx-vue-muted, #d1d5db);
	border: none;
	border-radius: 9999px;
	cursor: pointer;
	transition: background-color 0.15s ease;
}

.pptx-vue-settings-switch--on {
	background: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-settings-switch-knob {
	display: inline-block;
	width: 14px;
	height: 14px;
	margin-left: 3px;
	background: #ffffff;
	border-radius: 9999px;
	transition: transform 0.15s ease;
}

.pptx-vue-settings-switch--on .pptx-vue-settings-switch-knob {
	transform: translateX(16px);
}

.pptx-vue-settings-shortcut {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 6px 8px;
	border-radius: 4px;
}

.pptx-vue-settings-shortcut--alt {
	background: var(--pptx-vue-muted, #f3f4f6);
}

.pptx-vue-settings-shortcut-action {
	font-size: 12px;
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-settings-shortcut-keys {
	font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	font-size: 11px;
	white-space: nowrap;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-settings-btn {
	padding: 6px 12px;
	font-size: 12px;
	border: 1px solid transparent;
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-settings-btn--primary {
	color: var(--pptx-vue-primary-foreground, #ffffff);
	background: var(--pptx-vue-primary, #2563eb);
}
</style>
