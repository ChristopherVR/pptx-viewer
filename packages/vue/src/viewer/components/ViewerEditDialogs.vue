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
import type { PptxTheme } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

import type { UseCollaborationWiringResult } from '../composables/useCollaborationWiring';
import type { ContextMenuState } from '../composables/useContextMenu';
import type { UseHyperlinkDialogResult } from '../composables/useHyperlinkDialog';
import type { UseThemeEditingResult } from '../composables/useThemeEditing';
import type { ContextMenuItem } from './ContextMenu.vue';
import ContextMenu from './ContextMenu.vue';
import HyperlinkDialog from './HyperlinkDialog.vue';
import ThemeEditorPanel from './inspector/ThemeEditorPanel.vue';
import ShareDialog from './ShareDialog.vue';
import ThemeGallery from './ThemeGallery.vue';

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
	hyperlink: UseHyperlinkDialogResult;
	slideCount: number;
	collaboration: UseCollaborationWiringResult;
	shareDefaults?: { roomId?: string; userName?: string; serverUrl?: string };
}>();

const { t } = useI18n();
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
		:open="collaboration.shareOpen.value"
		:defaults="shareDefaults"
		:active="collaboration.collabActive.value"
		:collab="collaboration.collab"
		:active-collaboration="collaboration.activeCollaboration.value"
		@start="collaboration.onShareStart"
		@stop="collaboration.onShareStop"
		@close="collaboration.shareOpen.value = false"
	/>
</template>
