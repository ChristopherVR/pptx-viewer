<script setup lang="ts">
/**
 * ViewerEditDialogs: the popups reached while editing the canvas itself
 * (Design > Themes, the element context menu, Insert > Link, Share).
 *
 * Lifted out of `PowerPointViewer.vue` unchanged, and kept in their original
 * sibling order so nothing about stacking can shift.
 *
 * Open state arrives as a value plus an explicit close callback, NOT as a
 * `Ref`: a top-level `ref` in the parent's `<script setup>` is auto-unwrapped
 * when it is read in the parent's template, so a `Ref`-typed prop would
 * silently receive a plain boolean. Controllers that arrive as whole objects
 * (`hyperlink`, `collaboration`) are unaffected, since property access on a
 * plain object does not unwrap.
 */
import type { PptxLayoutOption, PptxLayoutPreview, PptxTheme } from 'pptx-viewer-core';
import { isDialogAvailable } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasContextMenuState } from '../composables/useCanvasContextMenu';
import type { UseCollaborationWiringResult } from '../composables/useCollaborationWiring';
import type { ContextMenuState } from '../composables/useContextMenu';
import type { UseHyperlinkDialogResult } from '../composables/useHyperlinkDialog';
import type { UsePasteSpecialResult } from '../composables/usePasteSpecial';
import type { UseThemeEditingResult } from '../composables/useThemeEditing';
import { useResolvedCustomization } from '../composables/useViewerCustomization';
import type { ContextMenuItem } from './ContextMenu.vue';
import ContextMenu from './ContextMenu.vue';
import HyperlinkDialog from './HyperlinkDialog.vue';
import ThemeEditorPanel from './inspector/ThemeEditorPanel.vue';
import PasteOptionsToolbar from './PasteOptionsToolbar.vue';
import PasteSpecialDialog from './PasteSpecialDialog.vue';
import LayoutGalleryMenu from './ribbon/LayoutGalleryMenu.vue';
import ShareDialog from './ShareDialog.vue';
import ThemeGallery from './ThemeGallery.vue';

/** The canvas context menu's "Layout" gallery, anchored at the click point. */
interface LayoutGalleryProps {
	anchor: { x: number; y: number } | null;
	layoutOptions: PptxLayoutOption[];
	previews: ReadonlyMap<string, PptxLayoutPreview>;
	currentLayoutPath?: string;
	onSelect: (layout: PptxLayoutOption) => void;
	onClose: () => void;
}

defineProps<{
	canEdit: boolean;
	theme: PptxTheme | undefined;
	themeGalleryOpen: boolean;
	onCloseThemeGallery: () => void;
	themeEditorOpen: boolean;
	onCloseThemeEditor: () => void;
	themeEditing: Pick<UseThemeEditingResult, 'applyThemePreset' | 'applyThemeEdit'>;
	contextMenu: ContextMenuState;
	contextItems: ContextMenuItem[];
	onContextSelect: (id: string) => void;
	onCloseContextMenu: () => void;
	canvasContextMenu: CanvasContextMenuState;
	canvasContextItems: ContextMenuItem[];
	onCanvasContextSelect: (id: string) => void;
	onCloseCanvasContextMenu: () => void;
	layoutGallery: LayoutGalleryProps;
	hyperlink: UseHyperlinkDialogResult;
	slideCount: number;
	collaboration: UseCollaborationWiringResult;
	shareDefaults?: { roomId?: string; userName?: string; serverUrl?: string };
	/** Ctrl/Cmd+Alt+V dialog + the post-paste Paste Options toolbar. */
	pasteSpecial: UsePasteSpecialResult;
}>();

const { t } = useI18n();
// The host can remove the Share dialog (hiddenDialogs / disabled collaboration).
const customization = useResolvedCustomization();
const shareAvailable = computed(() => isDialogAvailable(customization.value, 'share'));

/** Zero-size anchor positioned at the canvas menu's click point; `LayoutGalleryMenu` hangs off its rect. */
const layoutGalleryAnchorEl = ref<HTMLElement | null>(null);
</script>

<template>
	<!-- Design > Themes gallery -->
	<ThemeGallery
		:open="themeGalleryOpen"
		:active-name="theme?.name"
		:can-edit="canEdit"
		@apply="themeEditing.applyThemePreset"
		@close="onCloseThemeGallery"
	/>

	<!-- Design > Edit theme -->
	<ThemeEditorPanel
		v-if="themeEditorOpen && canEdit"
		:theme="theme"
		:can-edit="canEdit"
		@apply="themeEditing.applyThemeEdit"
		@close="onCloseThemeEditor"
	/>

	<!-- Element context menu (edit mode) -->
	<ContextMenu
		:open="contextMenu.open"
		:x="contextMenu.x"
		:y="contextMenu.y"
		:items="contextItems"
		:aria-label="t('pptx.contextMenu.ariaLabel')"
		@select="onContextSelect"
		@close="onCloseContextMenu"
	/>

	<!-- Empty-canvas context menu (edit mode) -->
	<ContextMenu
		:open="canvasContextMenu.open"
		:x="canvasContextMenu.x"
		:y="canvasContextMenu.y"
		:items="canvasContextItems"
		:aria-label="t('pptx.canvasContextMenu.ariaLabel')"
		:is-canvas-menu="true"
		@select="onCanvasContextSelect"
		@close="onCloseCanvasContextMenu"
	/>

	<!-- Canvas context menu's "Layout" gallery, anchored at the click point -->
	<template v-if="layoutGallery.anchor">
		<div
			ref="layoutGalleryAnchorEl"
			class="fixed"
			:style="{
				left: `${layoutGallery.anchor.x}px`,
				top: `${layoutGallery.anchor.y}px`,
				width: 0,
				height: 0,
			}"
		/>
		<div
			class="fixed inset-0 z-[119]"
			@click="layoutGallery.onClose"
			@contextmenu.prevent="layoutGallery.onClose"
		/>
		<LayoutGalleryMenu
			:anchor="layoutGalleryAnchorEl"
			:layout-options="layoutGallery.layoutOptions"
			:previews="layoutGallery.previews"
			:current-layout-path="layoutGallery.currentLayoutPath"
			@select="layoutGallery.onSelect"
		/>
	</template>

	<!-- Hyperlink editor -->
	<HyperlinkDialog
		:open="hyperlink.hyperlinkOpen.value"
		:element="hyperlink.hyperlinkTarget.value"
		:slide-count="slideCount"
		@save="hyperlink.onHyperlinkSave"
		@close="hyperlink.hyperlinkOpen.value = false"
	/>

	<!-- Share / collaboration -->
	<ShareDialog
		:open="collaboration.shareOpen.value && shareAvailable"
		:defaults="shareDefaults"
		:active="collaboration.collabActive.value"
		:collab="collaboration.collab"
		:active-collaboration="collaboration.activeCollaboration.value"
		@start="collaboration.onShareStart"
		@stop="collaboration.onShareStop"
		@close="collaboration.shareOpen.value = false"
	/>

	<!-- Paste Special (Ctrl/Cmd+Alt+V) + the post-paste Paste Options toolbar -->
	<PasteSpecialDialog
		:open="pasteSpecial.isPasteSpecialDialogOpen.value"
		@cancel="pasteSpecial.closePasteSpecialDialog"
		@confirm="pasteSpecial.pasteWithFormat"
	/>
	<PasteOptionsToolbar
		:element-id="pasteSpecial.pasteOptionsToolbar.value?.elementId ?? null"
		@choose="
			(format) => {
				pasteSpecial.reformatPastedElement(format);
				pasteSpecial.dismissPasteOptionsToolbar();
			}
		"
		@dismiss="pasteSpecial.dismissPasteOptionsToolbar"
	/>
</template>
