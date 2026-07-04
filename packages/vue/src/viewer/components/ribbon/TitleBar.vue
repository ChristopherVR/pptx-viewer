<script setup lang="ts">
import { Redo, Save, Search, Undo } from 'lucide-vue-next';
/**
 * TitleBar: Vue port of React's `toolbar/TitleBar.tsx`.
 *
 * PowerPoint-style title bar: AutoSave toggle, quick-access Save/Undo/Redo,
 * file name + save-location status, and a centred search box that opens the
 * Find & Replace panel. Rendered above (outside) the ribbon toolbar so it never
 * inflates the `role="toolbar"` element's measured height.
 *
 * The class tokens + status-key resolution come from `pptx-viewer-shared`
 * (`TITLE_BAR_CLASSES`, `resolveTitleBarStatusKey`), used verbatim like React,
 * so all three bindings render pixel-identical chrome.
 */
import {
	resolveTitleBarStatusKey,
	TITLE_BAR_CLASSES as TB,
	TITLE_BAR_DEFAULT_FILE_KEY,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import type { AutosaveStatus } from '../../composables/useAutosave';
import type { ViewerMode } from './ribbon-types';

interface Props {
	mode: ViewerMode;
	canEdit: boolean;
	/** Display name of the open document (host-supplied). */
	fileName?: string;
	isDirty: boolean;
	autosaveStatus?: AutosaveStatus;
	autosaveEnabled: boolean;
	onToggleAutosave: () => void;
	canUndo: boolean;
	canRedo: boolean;
	undoLabel?: string | null;
	redoLabel?: string | null;
	onUndo: () => void;
	onRedo: () => void;
	/** Quick-access save (downloads the .pptx). */
	onSave?: () => void;
	findReplaceOpen: boolean;
	onToggleFindReplace: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const editing = computed(() => (props.mode === 'edit' || props.mode === 'master') && props.canEdit);

const statusKey = computed(() =>
	resolveTitleBarStatusKey({
		autosaveState: props.autosaveStatus ?? 'idle',
		isDirty: props.isDirty,
		autosaveEnabled: props.autosaveEnabled,
	}),
);
</script>

<template>
	<div :class="TB.container" data-pptx-title-bar>
		<span :class="TB.logo" aria-hidden="true">P</span>

		<template v-if="editing">
			<span :class="TB.autosaveGroup">
				<span :class="TB.autosaveLabel">{{ t('pptx.titleBar.autoSave') }}</span>
				<button
					type="button"
					role="switch"
					:aria-checked="props.autosaveEnabled"
					:class="cn(TB.toggleTrack, props.autosaveEnabled ? TB.toggleTrackOn : TB.toggleTrackOff)"
					:title="t('pptx.titleBar.toggleAutoSave')"
					:aria-label="t('pptx.titleBar.toggleAutoSave')"
					@click="props.onToggleAutosave()"
				>
					<span
						:class="cn(TB.toggleKnob, props.autosaveEnabled ? TB.toggleKnobOn : TB.toggleKnobOff)"
					/>
				</button>
				<span :class="TB.autosaveLabel">
					{{ t(props.autosaveEnabled ? 'pptx.titleBar.autoSaveOn' : 'pptx.titleBar.autoSaveOff') }}
				</span>
			</span>

			<div :class="TB.separator" />

			<button
				v-if="props.onSave"
				type="button"
				:class="TB.quickButton"
				:title="t('pptx.titleBar.save')"
				:aria-label="t('pptx.titleBar.save')"
				@click="props.onSave()"
			>
				<Save class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				:disabled="!props.canUndo"
				:class="TB.quickButton"
				:title="
					props.undoLabel
						? t('pptx.toolbar.undoAction', { action: props.undoLabel })
						: t('pptx.toolbar.undo')
				"
				:aria-label="t('pptx.toolbar.undo')"
				@click="props.onUndo()"
			>
				<Undo class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				:disabled="!props.canRedo"
				:class="TB.quickButton"
				:title="
					props.redoLabel
						? t('pptx.toolbar.redoAction', { action: props.redoLabel })
						: t('pptx.toolbar.redo')
				"
				:aria-label="t('pptx.toolbar.redo')"
				@click="props.onRedo()"
			>
				<Redo class="w-3.5 h-3.5" />
			</button>

			<div :class="TB.separator" />
		</template>

		<span :class="TB.fileGroup">
			<span :class="TB.fileName">{{ props.fileName || t(TITLE_BAR_DEFAULT_FILE_KEY) }}</span>
			<template v-if="editing">
				<span :class="TB.statusDot" aria-hidden="true">&bull;</span>
				<span
					:class="
						cn(
							TB.statusText,
							props.autosaveStatus === 'error' && props.autosaveEnabled ? TB.statusError : '',
							props.autosaveStatus === 'saving' && props.autosaveEnabled ? TB.statusSaving : '',
						)
					"
				>
					{{ t(statusKey) }}
				</span>
			</template>
		</span>

		<span :class="TB.searchWrap">
			<button
				v-if="props.mode === 'edit' || props.mode === 'master'"
				type="button"
				:class="cn(TB.searchBox, props.findReplaceOpen ? 'text-foreground bg-background' : '')"
				:title="t('pptx.findReplace.title')"
				:aria-label="t('pptx.titleBar.search')"
				@click="props.onToggleFindReplace()"
			>
				<Search :class="TB.searchIcon" />
				<span :class="TB.searchLabel">{{ t('pptx.titleBar.search') }}</span>
			</button>
		</span>

		<!-- Right block mirrors the left visually; kept minimal. -->
		<span :class="TB.rightSpacer" />
	</div>
</template>
