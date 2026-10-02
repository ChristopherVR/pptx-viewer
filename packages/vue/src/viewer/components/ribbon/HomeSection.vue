<script setup lang="ts">
/**
 * HomeSection: the Vue 3 port of React's
 * `toolbar/HomeSection.tsx`. Renders the Home ribbon tab's Clipboard, Slides and
 * Font groups (Paste/Cut/Copy/Format Painter, New Slide + layout picker, and the
 * font-family / font-size dropdowns). A faithful, mechanical port for visual +
 * behavioral parity: class strings are copied verbatim, React's
 * `useState`/`useEffect(mousedown)` dropdown plumbing becomes `useDropdown`, and
 * the copied/cut feedback flashes use a `ref` + `setTimeout`.
 */
import type { PptxElement, PptxLayoutPreview } from 'pptx-viewer-core';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import { computed } from 'vue';

import ClipboardGroup from './ClipboardGroup.vue';
import { SEP } from './ribbon-constants';
import type { ElementClipboardPayload, LayoutOption } from './ribbon-types';
import SlidesGroup from './SlidesGroup.vue';

interface Props {
	canEdit: boolean;
	clipboardPayload: ElementClipboardPayload | null;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onToggleFormatPainter?: () => void;
	layoutOptions: LayoutOption[];
	/** Marks the active tile in the Layout menu. */
	currentLayoutPath?: string;
	/** Supplies gallery artwork; without it the menus stay name-only. */
	loadLayoutPreviews?: () => Promise<PptxLayoutPreview[]>;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	onInsertSlideFromTemplate?: (templateId: SlideTemplateId) => void;
	/** Deck scheme map so template previews show the deck's theme colours. */
	templateScheme?: Record<string, string>;
	onApplyLayout?: (path: string) => void;
	onResetSlide?: () => void;
	onAddSection?: () => void;
	selectedElement?: PptxElement | null;
}

const props = defineProps<Props>();

// Cut and Copy act on the selection, so with nothing selected they are no-ops.
// They used to render live anyway, offering a button that could not do anything.
const hasSelection = computed(() => Boolean(props.selectedElement));
</script>

<template>
	<!-- Clipboard group -->
	<ClipboardGroup
		:can-edit="props.canEdit"
		:has-selection="hasSelection"
		:clipboard-payload="props.clipboardPayload"
		:format-painter-active="props.formatPainterActive"
		:can-activate-format-painter="props.canActivateFormatPainter"
		:on-copy="props.onCopy"
		:on-cut="props.onCut"
		:on-paste="props.onPaste"
		:on-toggle-format-painter="props.onToggleFormatPainter"
	/>

	<div :class="SEP" />

	<!-- Slides group -->
	<SlidesGroup
		:can-edit="props.canEdit"
		:layout-options="props.layoutOptions"
		:current-layout-path="props.currentLayoutPath"
		:load-layout-previews="props.loadLayoutPreviews"
		:on-insert-slide-from-layout="props.onInsertSlideFromLayout"
		:on-insert-slide-from-template="props.onInsertSlideFromTemplate"
		:template-scheme="props.templateScheme"
		:on-apply-layout="props.onApplyLayout"
		:on-reset-slide="props.onResetSlide"
		:on-add-section="props.onAddSection"
	/>

</template>
