<script setup lang="ts">
/**
 * ClipboardGroup: the Home tab's Clipboard group. Markup, icons, gating and
 * styles come from the shared `pptx-ui-ribbon-home-clipboard` element; this
 * adapter only maps its one `home-request` intent onto the existing handlers.
 */
import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
import { clipboardHomeControls, homeSnapshotTranslator } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ElementClipboardPayload } from './ribbon-types';

interface Props {
	canEdit: boolean;
	/** Cut and Copy act on the selection, so with nothing selected they are disabled. */
	hasSelection: boolean;
	clipboardPayload: ElementClipboardPayload | null;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onToggleFormatPainter?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const state = computed(() => ({
	controls: clipboardHomeControls({
		editable: props.canEdit,
		hasSelection: props.hasSelection,
		hasClipboard: Boolean(props.clipboardPayload),
		formatPainterActive: Boolean(props.formatPainterActive),
		canFormatPaint: props.canActivateFormatPainter !== false,
		showFormatPainter: Boolean(props.onToggleFormatPainter),
	}),
	translate: homeSnapshotTranslator(['clipboard'], t),
}));

function request(event: RibbonHomeRequestEvent): void {
	switch (event.detail.id) {
		case 'home.clipboard.paste':
			props.onPaste();
			break;
		case 'home.clipboard.cut':
			props.onCut();
			break;
		case 'home.clipboard.copy':
			props.onCopy();
			break;
		case 'home.clipboard.formatPainter':
			props.onToggleFormatPainter?.();
	}
}
</script>

<template>
	<pptx-ui-ribbon-home-clipboard :state.prop="state" @home-request="request" />
</template>
