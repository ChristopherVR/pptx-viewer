<script setup lang="ts">
/**
 * TitleBar - thin adapter around the shared `pptx-ui-title-bar` element.
 *
 * The logo, AutoSave switch, quick-access strip, file name, status and command
 * search live in the shared view. This component maps viewer state onto the
 * element's controlled state and routes its typed events to the host handlers.
 * `placement="belowRibbon"` renders only the options-driven extras row.
 */
import { buildTitleBarState } from 'pptx-viewer-shared';
import type {
	TitleBarCommandSearchEvent,
	TitleBarEvent,
	TitleBarPlacement,
	ToolbarActionId,
} from 'pptx-viewer-shared';
import { computed, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';

import type { AutosaveStatus } from '../../composables/useAutosave';
import { useTitleBarQuickAccess } from '../../composables/useTitleBarQuickAccess';
import type { ViewerMode } from './ribbon-types';

interface Props {
	mode: ViewerMode;
	canEdit: boolean;
	fileName?: string;
	isDirty: boolean;
	autosaveStatus?: AutosaveStatus;
	autosaveEnabled: boolean;
	autosaveDisabledReason?: string;
	/** False when the host's `autosave: false` policy makes the switch inert. */
	autosaveToggleAvailable?: boolean;
	onToggleAutosave?: () => void;
	canUndo?: boolean;
	canRedo?: boolean;
	undoLabel?: string | null;
	redoLabel?: string | null;
	onUndo?: () => void;
	onRedo?: () => void;
	onSave?: () => void;
	findReplaceOpen?: boolean;
	onToggleFindReplace?: () => void;
	onCommandSearch?: (command: string) => void;
	/** Toolbar buttons the host has asked to hide (gates Undo/Redo independently). */
	hiddenActions?: ToolbarActionId[];
	/** Run a Quick Access command other than Save/Undo/Redo, by catalog id. */
	onQuickCommand?: (id: string) => void;
	/** `belowRibbon` renders only the extras row (Options > Quick Access > position). */
	placement?: TitleBarPlacement;
}

const props = withDefaults(defineProps<Props>(), { autosaveToggleAvailable: true });
const { t } = useI18n();
const slots = useSlots();
const { quickAccess, screenTip } = useTitleBarQuickAccess();

const state = computed(() =>
	buildTitleBarState({
		editing: (props.mode === 'edit' || props.mode === 'master') && props.canEdit,
		fileName: props.fileName,
		isDirty: props.isDirty,
		autosaveState: props.autosaveStatus,
		autosaveReason: props.autosaveDisabledReason,
		autosaveEnabled: props.autosaveEnabled,
		autosaveToggleAvailable: props.autosaveToggleAvailable,
		canUndo: props.canUndo ?? false,
		canRedo: props.canRedo ?? false,
		undoLabel: props.undoLabel,
		redoLabel: props.redoLabel,
		hiddenActions: props.hiddenActions,
		showSave: Boolean(props.onSave),
		quickAccess: quickAccess.value,
		screenTip,
		translate: t,
	}),
);

function onSearch(event: Event): void {
	const detail = (event as TitleBarCommandSearchEvent).detail;
	if (detail.command) {
		props.onCommandSearch?.(detail.command);
	} else {
		props.onToggleFindReplace?.();
	}
}
function onQuick(event: Event): void {
	props.onQuickCommand?.((event as TitleBarEvent<'quick-command'>).detail.id);
}
</script>

<template>
	<pptx-ui-title-bar
		:placement="props.placement ?? 'titleBar'"
		:state.prop="state"
		@toggle-autosave="props.onToggleAutosave?.()"
		@save="props.onSave?.()"
		@undo="props.onUndo?.()"
		@redo="props.onRedo?.()"
		@quick-command="onQuick"
		@command-search="onSearch"
	>
		<div v-if="slots.collaboration" slot="collaboration" style="display: contents">
			<slot name="collaboration" />
		</div>
		<div v-if="slots.account" slot="account" style="display: contents">
			<slot name="account" />
		</div>
	</pptx-ui-title-bar>
</template>
