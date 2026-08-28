<script setup lang="ts">
import { Redo, Save, Search, Undo } from 'lucide-vue-next';
import {
	DEFAULT_VIEWER_OPTIONS,
	extraQuickAccessCommands,
	filterCommands,
	resolveTitleBarStatusKey,
	TITLE_BAR_CLASSES as TB,
	TITLE_BAR_DEFAULT_FILE_KEY,
} from 'pptx-viewer-shared';
import type { CommandSearchEntry, ToolbarActionId } from 'pptx-viewer-shared';
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import type { AutosaveStatus } from '../../composables/useAutosave';
import { useToolbarVisibility } from '../../composables/useToolbarVisibility';
import { ViewerOptionsKey } from '../../composables/useViewerOptionsStore';
import type { ViewerMode } from './ribbon-types';
import TitleBarQuickAccess from './TitleBarQuickAccess.vue';

interface Props {
	mode: ViewerMode;
	canEdit: boolean;
	fileName?: string;
	isDirty: boolean;
	autosaveStatus?: AutosaveStatus;
	autosaveEnabled: boolean;
	autosaveDisabledReason?: string;
	onToggleAutosave: () => void;
	canUndo: boolean;
	canRedo: boolean;
	undoLabel?: string | null;
	redoLabel?: string | null;
	onUndo: () => void;
	onRedo: () => void;
	onSave?: () => void;
	findReplaceOpen: boolean;
	onToggleFindReplace: () => void;
	onCommandSearch?: (command: string) => void;
	/** Toolbar buttons the host has asked to hide (gates Undo/Redo independently below). */
	hiddenActions?: ToolbarActionId[];
	/**
	 * Run a Quick Access command that is not one of the dedicated
	 * Save/Undo/Redo buttons (`presentFromStart`, `print`, ...), by catalog id.
	 */
	onQuickCommand?: (id: string) => void;
}

const props = defineProps<Props>();
const { t } = useI18n();
const { isHidden } = useToolbarVisibility(() => props.hiddenActions);

// The strip beyond Save/Undo/Redo comes from File > Options; hardcoding three
// buttons is what left this binding a command short of the shared default.
const viewerOptions = inject(ViewerOptionsKey, undefined);
const quickAccess = computed(
	() => viewerOptions?.value.quickAccess ?? DEFAULT_VIEWER_OPTIONS.quickAccess,
);
// Options > Quick Access Toolbar > position: when set to "below the Ribbon",
// `PowerPointViewer.vue` renders the strip in its own row under the ribbon
// instead, so the title bar suppresses its inline copy to avoid duplicates.
const extraQuickCommands = computed(() =>
	(quickAccess.value.visible && quickAccess.value.position !== 'below'
		? extraQuickAccessCommands(quickAccess.value.commandIds)
		: []
	).map((command) => ({ id: command.id, label: t(command.labelKey), icon: command.icon })),
);

const editing = computed(() => (props.mode === 'edit' || props.mode === 'master') && props.canEdit);

const statusKey = computed(() =>
	resolveTitleBarStatusKey({
		autosaveState: props.autosaveStatus ?? 'idle',
		isDirty: props.isDirty,
		autosaveEnabled: props.autosaveEnabled,
		disabledReason: props.autosaveDisabledReason,
	}),
);

const searchQuery = ref('');
const searchFocused = ref(false);
const searchRef = ref<HTMLDivElement | null>(null);

const commandResults = computed(() => filterCommands(searchQuery.value, t));

function handleCommandSelect(entry: CommandSearchEntry): void {
	props.onCommandSearch?.(entry.command);
	searchQuery.value = '';
	searchFocused.value = false;
}

function handleSearchKeyDown(e: KeyboardEvent): void {
	if (e.key === 'Enter' && searchQuery.value.trim()) {
		if (commandResults.value.length > 0) {
			handleCommandSelect(commandResults.value[0]);
		} else {
			props.onToggleFindReplace();
			searchFocused.value = false;
		}
	} else if (e.key === 'Escape') {
		searchQuery.value = '';
		searchFocused.value = false;
	}
}

function handleOutsideClick(e: MouseEvent): void {
	if (searchRef.value && !searchRef.value.contains(e.target as Node)) {
		searchFocused.value = false;
	}
}

onMounted(() => document.addEventListener('mousedown', handleOutsideClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', handleOutsideClick));
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
				v-if="!isHidden('undo')"
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
				v-if="!isHidden('redo')"
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
			<!-- Everything else File > Options > Quick Access Toolbar asks for. -->
			<TitleBarQuickAccess
				v-if="extraQuickCommands.length > 0"
				:items="extraQuickCommands"
				:show-labels="quickAccess.showCommandLabels"
				:on-command="(id: string) => props.onQuickCommand?.(id)"
			/>

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
			<div
				v-if="props.mode === 'edit' || props.mode === 'master'"
				ref="searchRef"
				class="relative w-full max-w-md"
			>
				<div
					:class="
						cn(
							TB.searchBox,
							searchFocused || props.findReplaceOpen ? 'text-foreground bg-background' : '',
						)
					"
				>
					<Search :class="TB.searchIcon" />
					<input
						v-model="searchQuery"
						type="text"
						class="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/60"
						:placeholder="t('pptx.titleBar.searchPlaceholder')"
						:aria-label="t('pptx.titleBar.search')"
						@focus="searchFocused = true"
						@keydown="handleSearchKeyDown"
					/>
				</div>
				<div
					v-if="searchFocused && searchQuery.trim()"
					class="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-xl max-h-64 overflow-y-auto"
				>
					<template v-if="commandResults.length > 0">
						<div
							class="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
						>
							{{ t('pptx.titleBar.searchCommands') }}
						</div>
						<button
							v-for="entry in commandResults.slice(0, 8)"
							:key="entry.command"
							type="button"
							class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
							@mousedown="handleCommandSelect(entry)"
						>
							<span class="truncate">{{ t(entry.labelKey) }}</span>
							<span class="ml-auto text-[10px] text-muted-foreground capitalize">{{
								entry.category
							}}</span>
						</button>
					</template>
					<div v-else class="px-3 py-2 text-xs text-muted-foreground">
						{{ t('pptx.titleBar.searchNoResults') }}
					</div>
					<div class="border-t border-border/60">
						<button
							type="button"
							class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
							@mousedown="
								props.onToggleFindReplace();
								searchFocused = false;
								searchQuery = '';
							"
						>
							<Search class="w-3 h-3 shrink-0" />
							<span>{{ t('pptx.titleBar.searchContent') }} &ldquo;{{ searchQuery }}&rdquo;</span>
						</button>
					</div>
				</div>
			</div>
		</span>

		<!-- Right block mirrors the left visually; kept minimal. -->
		<span :class="TB.rightSpacer" />
	</div>
</template>
