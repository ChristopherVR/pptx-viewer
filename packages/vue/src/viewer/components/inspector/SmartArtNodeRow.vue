<script setup lang="ts">
import type { PptxSmartArtNode, PptxSmartArtNodeStyle } from 'pptx-viewer-core';
import type { ComponentPublicInstance } from 'vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';

/**
 * SmartArtNodeRow: a single editable node row in the SmartArt text pane.
 *
 * Vue port of the React `SmartArtNodeRow.tsx`, extended with per-node visual
 * overrides (fill colour, font colour, bold, italic). Purely presentational:
 * every mutation is routed back through events so the editing logic stays in the
 * parent composable / core ops. Renders as a `role="listitem"` for AT.
 */
const props = defineProps<{
	node: PptxSmartArtNode;
	/** 1-based display number among top-level nodes (0 for child rows). */
	displayIndex: number;
	isChild: boolean;
	canEdit: boolean;
	removeDisabled: boolean;
	moveUpDisabled: boolean;
	moveDownDisabled: boolean;
}>();

const emit = defineEmits<{
	changeText: [nodeId: string, text: string];
	keydownNode: [event: KeyboardEvent, nodeId: string];
	setStyle: [nodeId: string, style: Partial<PptxSmartArtNodeStyle>];
	addSubItem: [nodeId: string];
	moveUp: [nodeId: string];
	moveDown: [nodeId: string];
	remove: [nodeId: string];
	registerInput: [nodeId: string, el: HTMLInputElement | null];
}>();

const { t } = useI18n();
const recentColors = injectRecentColors();

/** Child-node marker glyph (U+2022 bullet) shown in the text-pane list. */
const bulletGlyph = String.fromCharCode(0x2022);

const label = computed(() => {
	const text = props.node.text || t('pptx.smartArt.emptyNode');
	return props.isChild
		? t('pptx.smartArt.subItemLabel', { text })
		: t('pptx.smartArt.itemLabel', { index: props.displayIndex, text });
});

const fillColor = computed(() => props.node.style?.fillColor ?? '#3b82f6');
const fontColor = computed(() => props.node.style?.fontColor ?? '#ffffff');
const isBold = computed(() => props.node.style?.bold === true);
const isItalic = computed(() => props.node.style?.italic === true);

function onText(event: Event): void {
	emit('changeText', props.node.id, (event.target as HTMLInputElement).value);
}

function onFill(event: Event): void {
	emit('setStyle', props.node.id, { fillColor: (event.target as HTMLInputElement).value });
}

function onFont(event: Event): void {
	emit('setStyle', props.node.id, { fontColor: (event.target as HTMLInputElement).value });
}

function onColorCommit(event: Event): void {
	recentColors?.push((event.target as HTMLInputElement).value);
}

function toggleBold(): void {
	emit('setStyle', props.node.id, { bold: !isBold.value });
}

function toggleItalic(): void {
	emit('setStyle', props.node.id, { italic: !isItalic.value });
}

function bindInput(el: Element | ComponentPublicInstance | null): void {
	emit('registerInput', props.node.id, el instanceof HTMLInputElement ? el : null);
}
</script>

<template>
	<div
		role="listitem"
		class="rounded border bg-background/60 p-1.5"
		:class="isChild ? 'border-border/60 ml-4' : 'border-border'"
		data-testid="smartart-node"
	>
		<div class="flex items-center gap-1">
			<span class="text-[9px] text-muted-foreground w-3 shrink-0" aria-hidden="true">
				{{ isChild ? bulletGlyph : `${displayIndex}` }}
			</span>
			<input
				:ref="bindInput"
				type="text"
				:disabled="!canEdit"
				:aria-label="label"
				data-testid="smartart-node-text"
				class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 text-[11px]"
				:value="node.text"
				:placeholder="t('pptx.smartArt.nodePlaceholder')"
				@input="onText"
				@keydown="emit('keydownNode', $event, node.id)"
			/>
			<div class="flex items-center gap-0.5 shrink-0">
				<button
					type="button"
					:disabled="!canEdit || moveUpDisabled"
					data-testid="smartart-move-up"
					class="text-[9px] text-muted-foreground hover:text-primary px-1 disabled:opacity-40"
					:aria-label="t('pptx.smartArt.moveUpLabel', { label })"
					:title="t('pptx.smartArt.moveUp')"
					@click="emit('moveUp', node.id)"
				>
					&uarr;
				</button>
				<button
					type="button"
					:disabled="!canEdit || moveDownDisabled"
					data-testid="smartart-move-down"
					class="text-[9px] text-muted-foreground hover:text-primary px-1 disabled:opacity-40"
					:aria-label="t('pptx.smartArt.moveDownLabel', { label })"
					:title="t('pptx.smartArt.moveDown')"
					@click="emit('moveDown', node.id)"
				>
					&darr;
				</button>
				<button
					v-if="!isChild"
					type="button"
					:disabled="!canEdit"
					data-testid="smartart-add-sub"
					class="text-[9px] text-muted-foreground hover:text-primary px-1"
					:aria-label="t('pptx.smartArt.addSubItemLabel', { label })"
					:title="t('pptx.smartArt.addSubItem')"
					@click="emit('addSubItem', node.id)"
				>
					+Sub
				</button>
				<button
					type="button"
					:disabled="!canEdit || removeDisabled"
					data-testid="smartart-remove"
					class="text-[9px] text-muted-foreground hover:text-red-400 px-1 disabled:opacity-40"
					:aria-label="t('pptx.smartArt.removeLabel', { label })"
					:title="removeDisabled ? t('pptx.smartArt.layoutMinimum') : t('pptx.smartArt.remove')"
					@click="emit('remove', node.id)"
				>
					x
				</button>
			</div>
		</div>
		<div class="flex items-center gap-1.5 mt-1 pl-4">
			<label class="flex items-center gap-1 text-[9px] text-muted-foreground">
				{{ t('pptx.smartArt.fill') }}
				<input
					type="color"
					:disabled="!canEdit"
					data-testid="smartart-node-fill"
					:aria-label="t('pptx.smartArt.fillColorLabel', { label })"
					class="h-4 w-5 rounded border border-border bg-transparent p-0"
					:value="fillColor"
					@input="onFill"
					@change="onColorCommit"
				/>
			</label>
			<label class="flex items-center gap-1 text-[9px] text-muted-foreground">
				{{ t('pptx.smartArt.text') }}
				<input
					type="color"
					:disabled="!canEdit"
					data-testid="smartart-node-font"
					:aria-label="t('pptx.smartArt.fontColorLabel', { label })"
					class="h-4 w-5 rounded border border-border bg-transparent p-0"
					:value="fontColor"
					@input="onFont"
					@change="onColorCommit"
				/>
			</label>
			<button
				type="button"
				:disabled="!canEdit"
				data-testid="smartart-node-bold"
				:aria-pressed="isBold"
				:aria-label="t('pptx.smartArt.boldLabel', { label })"
				class="text-[10px] font-bold px-1 rounded border"
				:class="
					isBold
						? 'border-primary bg-primary/20 text-primary'
						: 'border-border text-muted-foreground'
				"
				@click="toggleBold"
			>
				B
			</button>
			<button
				type="button"
				:disabled="!canEdit"
				data-testid="smartart-node-italic"
				:aria-pressed="isItalic"
				:aria-label="t('pptx.smartArt.italicLabel', { label })"
				class="text-[10px] italic px-1 rounded border"
				:class="
					isItalic
						? 'border-primary bg-primary/20 text-primary'
						: 'border-border text-muted-foreground'
				"
				@click="toggleItalic"
			>
				I
			</button>
		</div>
	</div>
</template>
