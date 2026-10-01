<script setup lang="ts">
/**
 * ViewSection: thin adapter for the shared `pptx-ui-ribbon-view`. The shared
 * element owns the groups, icons, labels and pressed/disabled state; this
 * component supplies viewer options and routes typed intents to the native
 * handlers. Guides toggles guide visibility only; Snap to shape is its own flag.
 */
import type { RibbonViewRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
	canEdit: boolean;
	editTemplateMode: boolean;
	onSetEditTemplateMode: (mode: boolean) => void;
	spellCheckEnabled: boolean;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	showGrid: boolean;
	showRulers: boolean;
	/** Guide-overlay visibility only; the guides themselves stay in the model. */
	showGuides: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
	onSetShowGrid: (enabled: boolean) => void;
	onSetShowRulers: (enabled: boolean) => void;
	onSetShowGuides: (enabled: boolean) => void;
	onSetSnapToGrid: (enabled: boolean) => void;
	onSetSnapToShape: (enabled: boolean) => void;
	onAddGuide: (axis: 'h' | 'v') => void;
	onEnterMasterView: () => void;
	isSelectionPaneOpen?: boolean;
	onToggleSelectionPane?: () => void;
	eyedropperActive?: boolean;
	onToggleEyedropper?: () => void;
	onToggleSlideSorter?: () => void;
	onGoToNormalView?: () => void;
	onOpenReadingView?: () => void;
	/** Enter PowerPoint's Outline view: the deck as editable indented text. */
	onOpenOutlineView?: () => void;
	onZoomToFit?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();
const state = computed(() => ({
	editable: props.canEdit,
	showRulers: props.showRulers,
	showGrid: props.showGrid,
	showGuides: props.showGuides,
	snapToGrid: props.snapToGrid,
	snapToShape: props.snapToShape,
	templateEditing: props.editTemplateMode,
	selectionPaneOpen: props.isSelectionPaneOpen,
	eyedropperActive: props.eyedropperActive,
	selectionPaneAvailable: Boolean(props.onToggleSelectionPane),
	eyedropperAvailable: Boolean(props.onToggleEyedropper),
	translate: t,
}));

function request(event: RibbonViewRequestEvent): void {
	const intent = event.detail;
	if (intent.kind === 'guide') {
		props.onAddGuide(intent.axis);
	} else if (intent.kind === 'option') {
		const setters = {
			showRulers: props.onSetShowRulers,
			showGrid: props.onSetShowGrid,
			showGuides: props.onSetShowGuides,
			snapToGrid: props.onSetSnapToGrid,
			snapToShape: props.onSetSnapToShape,
			templateEditing: props.onSetEditTemplateMode,
		};
		setters[intent.value](intent.enabled);
	} else {
		const commands = {
			normal: props.onGoToNormalView,
			slideSorter: props.onToggleSlideSorter,
			outline: props.onOpenOutlineView,
			readingView: props.onOpenReadingView,
			slideMaster: props.onEnterMasterView,
			selectionPane: props.onToggleSelectionPane,
			eyedropper: props.onToggleEyedropper,
			zoomToFit: props.onZoomToFit,
		};
		commands[intent.value]?.();
	}
}
</script>

<template>
	<pptx-ui-ribbon-view :state.prop="state" @view-request="request" />
</template>
