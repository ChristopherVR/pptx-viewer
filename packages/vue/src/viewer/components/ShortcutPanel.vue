<script setup lang="ts">
/**
 * ShortcutPanel — grouped, searchable keyboard-shortcut help overlay.
 *
 * Vue port of the React `ShortcutPanel.tsx`. Where the React panel renders a
 * flat `SHORTCUT_REFERENCE_ITEMS` list, this version renders the
 * {@link SHORTCUT_CATALOG} grouped by `group`, with a live filter input and
 * platform-aware key glyphs (⌘ vs Ctrl). It reuses {@link ModalDialog} for the
 * teleported shell, backdrop/Esc close, and header chrome.
 *
 * Presentational: the parent owns the `open` flag and handles `close`.
 */
import { computed, ref, watch } from 'vue';

import { SHORTCUT_CATALOG, groupShortcutCatalog } from '../composables/useKeyboardShortcuts';
import type { ShortcutDefinition } from '../composables/useKeyboardShortcuts';
import ModalDialog from './ModalDialog.vue';

const props = defineProps<{
	/** Whether the help overlay is visible. */
	open: boolean;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
}>();

/** Live filter query over the shortcut descriptions + combos. */
const query = ref('');

// Reset the filter each time the panel opens so it never reopens pre-filtered.
watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) {
			query.value = '';
		}
	},
);

/** True on macOS — drives the ⌘ vs Ctrl glyph. */
const isMac = computed(() => {
	if (typeof navigator === 'undefined') {
		return false;
	}
	const platform = navigator.platform ?? '';
	const ua = navigator.userAgent ?? '';
	return /mac|iphone|ipad|ipod/iu.test(platform) || /mac/iu.test(ua);
});

/** Render a single combo token into a platform-aware glyph/label. */
function tokenGlyph(token: string): string {
	switch (token) {
		case 'Mod':
			return isMac.value ? '⌘' : 'Ctrl';
		case 'Shift':
			return isMac.value ? '⇧' : 'Shift';
		case 'ArrowKeys':
			return '←↑→↓';
		case 'ArrowLeft':
			return '←';
		case 'ArrowRight':
			return '→';
		case 'Delete':
			return isMac.value ? 'Delete / ⌫' : 'Delete / Backspace';
		case 'Escape':
			return 'Esc';
		default:
			return token;
	}
}

/** Render a `combo` string (e.g. `Mod+Shift+Z`) into its display glyphs. */
function comboGlyphs(combo: string): string {
	return combo
		.split('+')
		.map(tokenGlyph)
		.join(isMac.value ? '' : '+');
}

/** The catalog filtered by the live query, then grouped for display. */
const groups = computed(() => {
	const needle = query.value.trim().toLowerCase();
	const filtered: ShortcutDefinition[] =
		needle.length === 0
			? [...SHORTCUT_CATALOG]
			: SHORTCUT_CATALOG.filter(
					(entry) =>
						entry.description.toLowerCase().includes(needle) ||
						comboGlyphs(entry.combo).toLowerCase().includes(needle) ||
						entry.combo.toLowerCase().includes(needle),
				);
	return groupShortcutCatalog(filtered);
});

const hasResults = computed(() => groups.value.length > 0);

function requestClose(): void {
	emit('close');
}
</script>

<template>
	<ModalDialog :open="open" title="Keyboard shortcuts" @close="requestClose">
		<div class="pptx-vue-shortcuts" data-pptx-shortcuts-panel="true">
			<input
				v-model="query"
				type="text"
				class="pptx-vue-shortcuts-search"
				placeholder="Search shortcuts…"
				aria-label="Search shortcuts"
			/>

			<div v-if="hasResults" class="pptx-vue-shortcuts-list">
				<section v-for="bucket in groups" :key="bucket.group" class="pptx-vue-shortcuts-group">
					<h3 class="pptx-vue-shortcuts-group-title">{{ bucket.label }}</h3>
					<div
						v-for="shortcut in bucket.shortcuts"
						:key="shortcut.id"
						class="pptx-vue-shortcuts-row"
					>
						<span class="pptx-vue-shortcuts-desc">{{ shortcut.description }}</span>
						<kbd class="pptx-vue-shortcuts-combo">{{ comboGlyphs(shortcut.combo) }}</kbd>
					</div>
				</section>
			</div>

			<p v-else class="pptx-vue-shortcuts-empty">No shortcuts match “{{ query }}”.</p>
		</div>
	</ModalDialog>
</template>

<style scoped>
.pptx-vue-shortcuts {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	min-width: 18rem;
}

.pptx-vue-shortcuts-search {
	width: 100%;
	padding: 0.375rem 0.625rem;
	background: var(--pptx-vue-muted, #f3f4f6);
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 0.375rem;
	color: var(--pptx-vue-foreground, #111827);
	font: inherit;
}

.pptx-vue-shortcuts-search:focus {
	outline: none;
	border-color: #3b82f6;
}

.pptx-vue-shortcuts-list {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	max-height: 22rem;
	overflow-y: auto;
}

.pptx-vue-shortcuts-group {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.pptx-vue-shortcuts-group-title {
	margin: 0;
	font-size: 0.6875rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-shortcuts-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	padding: 0.375rem 0.5rem;
	background: var(--pptx-vue-muted, #f3f4f6);
	border-radius: 0.375rem;
}

.pptx-vue-shortcuts-desc {
	font-size: 0.8125rem;
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-shortcuts-combo {
	flex: 0 0 auto;
	padding: 0.125rem 0.5rem;
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	font-size: 0.75rem;
	white-space: nowrap;
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-popover, #ffffff);
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 0.25rem;
}

.pptx-vue-shortcuts-empty {
	margin: 0;
	padding: 0.75rem 0.5rem;
	font-size: 0.8125rem;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}
</style>
