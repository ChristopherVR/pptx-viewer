<script setup lang="ts">
import { Eye, EyeOff, GripVertical } from 'lucide-vue-next';
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { resolveSelectionPaneRename, restoreEditorKeyboardFocus } from 'pptx-viewer-shared';
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * SelectionPane: lists every element on the active slide with visibility
 * toggles, drag-to-reorder (z-order), and double-click-to-rename. Vue port of
 * the React `SelectionPane.tsx`. The pane is presentational: it emits
 * `select`, `toggle-visibility`, `reorder`, and `rename`; the host routes
 * those through the history-tracked editor operations so they undo/redo like
 * any other edit.
 */
const props = defineProps<{
	elements: PptxElement[];
	selectedIds: string[];
	canEdit: boolean;
}>();

const emit = defineEmits<{
	select: [id: string];
	'toggle-visibility': [id: string];
	reorder: [payload: { from: number; to: number }];
	rename: [payload: { id: string; name: string }];
	close: [];
}>();

const { t } = useI18n();

const TYPE_LABEL_KEYS: Record<string, string> = {
	text: 'pptx.elementType.textBox',
	shape: 'pptx.elementType.shape',
	connector: 'pptx.elementType.connector',
	image: 'pptx.elementType.image',
	picture: 'pptx.elementType.picture',
	chart: 'pptx.elementType.chart',
	table: 'pptx.elementType.table',
	smartArt: 'pptx.elementType.smartArt',
	media: 'pptx.elementType.media',
	group: 'pptx.elementType.group',
	ink: 'pptx.elementType.ink',
	ole: 'pptx.elementType.object',
	unknown: 'pptx.elementType.object',
};

function displayName(element: PptxElement, index: number): string {
	if (element.name && element.name.trim().length > 0) {
		return element.name.trim();
	}
	if (hasTextProperties(element) && element.text && element.text.trim().length > 0) {
		return element.text.trim().slice(0, 32);
	}
	const typeKey = TYPE_LABEL_KEYS[element.type] ?? 'pptx.elementType.object';
	return t('pptx.selectionPane.elementLabel', { type: t(typeKey), number: index + 1 });
}

// -- Inline rename (double-click the row label, like React) ------------------
const editingId = ref<string | null>(null);
const editDraft = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);
/** Function ref: a string ref inside `v-for` would collect into an array. */
function setRenameInput(el: unknown): void {
	renameInputRef.value = el instanceof HTMLInputElement ? el : null;
}
// The display name the rename input was seeded with: an unedited commit (blur
// or Enter without typing) must not write that fallback label into the element
// as its name. Mirrors React's `editSeedRef`.
let editSeed = '';

function startRename(element: PptxElement, index: number): void {
	if (!props.canEdit) {
		return;
	}
	editingId.value = element.id;
	editDraft.value = displayName(element, index);
	editSeed = editDraft.value;
	void nextTick(() => {
		renameInputRef.value?.focus();
		renameInputRef.value?.select();
	});
}

/**
 * Give the keyboard back to the viewer root before the input unmounts.
 *
 * Without this, focus lands on `document.body` when the input goes away and
 * the viewer (which listens for `keydown` on its own root) never sees the
 * Ctrl+Z that undoes the rename. Shared, because three bindings had it.
 */
function releaseRenameFocus(): void {
	restoreEditorKeyboardFocus(renameInputRef.value);
}

/** Commit the trimmed draft: non-empty renames, empty clears the name. */
function commitRename(element: PptxElement): void {
	if (editingId.value !== element.id) {
		return;
	}
	// Clear first: focusing the root blurs the input, and the `blur` handler
	// re-enters here. With `editingId` already null that re-entry is a no-op.
	editingId.value = null;
	releaseRenameFocus();
	// Shared decision: `null` for an unedited commit (so a fallback display
	// label is never persisted as a real name), otherwise the name to write -
	// including `''` for a cleared box, which is the only value the save writer
	// reads as a clear.
	const commit = resolveSelectionPaneRename(editSeed, editDraft.value);
	if (!commit) {
		return;
	}
	emit('rename', { id: element.id, name: commit.name });
}

/** Escape: drop the draft without emitting (clearing first disarms blur). */
function cancelRename(): void {
	editingId.value = null;
	releaseRenameFocus();
}

// Top-most element first (reverse of paint order), matching PowerPoint.
const rows = computed(() =>
	props.elements
		.map((element, index) => ({ element, index }))
		.slice()
		.reverse(),
);

const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function onDragStart(index: number): void {
	dragIndex.value = index;
}

function onDragOver(event: DragEvent, index: number): void {
	event.preventDefault();
	if (dragIndex.value !== null && dragIndex.value !== index) {
		dragOverIndex.value = index;
	}
}

function onDrop(targetIndex: number): void {
	const from = dragIndex.value;
	dragIndex.value = null;
	dragOverIndex.value = null;
	if (from === null || from === targetIndex) {
		return;
	}
	emit('reorder', { from, to: targetIndex });
}
</script>

<template>
	<div class="flex h-full w-56 flex-col border-l border-border bg-popover" data-pptx-selection-pane>
		<div class="flex items-center justify-between border-b border-border px-3 py-2">
			<span class="text-xs font-medium text-foreground">{{ t('pptx.selectionPane.heading') }}</span>
			<button
				type="button"
				class="text-xs text-muted-foreground hover:text-foreground"
				:title="t('pptx.selectionPane.close')"
				@click="emit('close')"
			>
				&times;
			</button>
		</div>
		<div class="flex-1 overflow-y-auto py-1">
			<div v-if="rows.length === 0" class="px-3 py-4 text-xs italic text-muted-foreground">
				{{ t('pptx.selectionPane.noObjects') }}
			</div>
			<div
				v-for="{ element, index } in rows"
				v-else
				:key="element.id"
				:draggable="props.canEdit && editingId !== element.id"
				class="flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs transition-colors"
				:class="[
					props.selectedIds.includes(element.id)
						? 'bg-primary/30 text-primary'
						: 'text-foreground hover:bg-muted',
					dragOverIndex === index ? 'border-t-2 border-primary' : '',
				]"
				@click="emit('select', element.id)"
				@dragstart="onDragStart(index)"
				@dragover="onDragOver($event, index)"
				@drop="onDrop(index)"
				@dragend="
					dragIndex = null;
					dragOverIndex = null;
				"
			>
				<GripVertical
					v-if="props.canEdit"
					class="h-3 w-3 flex-shrink-0 cursor-grab text-muted-foreground"
				/>
				<span
					class="flex-1 truncate"
					data-pptx-selection-name
					@dblclick.stop="startRename(element, index)"
				>
					<input
						v-if="editingId === element.id"
						:ref="setRenameInput"
						type="text"
						:aria-label="t('pptx.selectionPane.renameElement')"
						:value="editDraft"
						class="w-full rounded border border-border bg-muted px-1 py-0.5 text-xs outline-none"
						@input="editDraft = ($event.target as HTMLInputElement).value"
						@blur="commitRename(element)"
						@keydown.enter="commitRename(element)"
						@keydown.escape="cancelRename"
						@click.stop
					/>
					<template v-else>{{ displayName(element, index) }}</template>
				</span>
				<button
					type="button"
					class="flex-shrink-0 text-muted-foreground hover:text-foreground"
					:title="element.hidden ? t('pptx.selectionPane.show') : t('pptx.selectionPane.hide')"
					@click.stop="emit('toggle-visibility', element.id)"
				>
					<EyeOff v-if="element.hidden" class="h-3.5 w-3.5" />
					<Eye v-else class="h-3.5 w-3.5 opacity-50" />
				</button>
			</div>
		</div>
	</div>
</template>
