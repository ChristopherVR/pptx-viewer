<script setup lang="ts">
/**
 * StatusBar - Vue port of React's `components/StatusBar.tsx`.
 *
 * The bottom strip: slide counter + language + autosave status on the left, then
 * a Notes toggle, the view-mode buttons (Normal / Slide Sorter / Slide Show),
 * and zoom controls on the right. Class strings are copied verbatim from React
 * for visual parity; `react-icons/lu` glyphs map to `lucide-vue-next`, and the
 * i18n keys become their English literals.
 */
import { Columns2, Minus, Monitor, Plus, Presentation, StickyNote } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../utils';
import type { AutosaveStatus } from '../composables/useAutosave';

const { t } = useI18n();

const props = defineProps<{
	slideCount: number;
	activeSlideIndex: number;
	isDirty: boolean;
	autosaveStatus?: AutosaveStatus;
	/** Current zoom scale (1 = 100%). */
	scale?: number;
	/** Whether the notes panel is expanded. */
	isNotesExpanded?: boolean;
	/** Current viewer mode. */
	mode?: string;
	/** Whether the Notes toggle is shown (host has a notes panel). */
	showNotes?: boolean;
}>();

const emit = defineEmits<{
	'zoom-in': [];
	'zoom-out': [];
	'zoom-to-fit': [];
	'toggle-notes': [];
	'set-mode': [mode: 'edit' | 'present'];
	'toggle-slide-sorter': [];
}>();

const vb =
	'p-1 rounded-sm transition-colors hover:bg-accent/60 text-muted-foreground active:scale-95 active:opacity-80';

const statusText = computed(() => {
	if (props.autosaveStatus === 'saving') {
		return t('pptx.autosave.saving');
	}
	if (props.autosaveStatus === 'error') {
		return t('pptx.autosave.error');
	}
	if (props.autosaveStatus === 'saved') {
		return t('pptx.autosave.saved', { time: '' }).trim();
	}
	return props.isDirty ? t('pptx.statusBar.unsavedChanges') : t('pptx.statusBar.allSaved');
});
</script>

<template>
	<div
		class="w-full px-2 py-0.5 border-t border-border bg-secondary/50 text-[10px] text-muted-foreground flex items-center gap-1"
	>
		<!-- Left: slide counter + autosave status -->
		<span class="shrink-0">
			{{
				props.slideCount > 0
					? t('pptx.statusBar.slideOf', {
							current: Math.min(props.activeSlideIndex + 1, props.slideCount),
							total: props.slideCount,
						})
					: t('pptx.statusBar.noSlides')
			}}
		</span>

		<div class="w-px h-3 bg-border/40 mx-1 max-md:hidden" />

		<span class="shrink-0 max-md:hidden text-[10px]">{{ t('pptx.statusBar.language') }}</span>

		<div class="w-px h-3 bg-border/60 mx-1 max-md:hidden" />

		<span
			:class="
				cn(
					'shrink-0 max-md:hidden',
					props.autosaveStatus === 'error'
						? 'text-red-400'
						: props.autosaveStatus === 'saving'
							? 'text-yellow-400'
							: '',
				)
			"
		>
			{{ statusText }}
		</span>

		<!-- Center spacer -->
		<div class="flex-1" />

		<!-- Notes toggle -->
		<button
			v-if="props.showNotes"
			type="button"
			:class="
				cn(vb, 'flex items-center gap-1 text-[10px]', props.isNotesExpanded && 'text-primary')
			"
			:title="t('pptx.statusBar.toggleNotes')"
			:aria-label="t('pptx.statusBar.toggleNotes')"
			@click="emit('toggle-notes')"
		>
			<StickyNote class="w-3 h-3" />
			<span class="max-md:hidden">{{ t('pptx.notes.title') }}</span>
		</button>

		<div class="w-px h-3 bg-border/60 mx-0.5" />

		<!-- View-mode buttons -->
		<div class="flex items-center gap-0.5">
			<button
				type="button"
				:class="cn(vb, props.mode === 'edit' && 'text-primary')"
				:title="t('pptx.statusBar.normalView')"
				:aria-label="t('pptx.statusBar.normalView')"
				@click="emit('set-mode', 'edit')"
			>
				<Monitor class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				:class="vb"
				:title="t('pptx.statusBar.slideSorter')"
				:aria-label="t('pptx.statusBar.slideSorter')"
				@click="emit('toggle-slide-sorter')"
			>
				<Columns2 class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				:class="cn(vb, props.mode === 'present' && 'text-primary')"
				:title="t('pptx.statusBar.slideShow')"
				:aria-label="t('pptx.statusBar.slideShow')"
				@click="emit('set-mode', 'present')"
			>
				<Presentation class="w-3.5 h-3.5" />
			</button>
		</div>

		<!-- Zoom controls -->
		<template v-if="props.scale !== undefined">
			<div class="w-px h-3 bg-border/60 mx-0.5" />
			<div class="flex items-center gap-0.5">
				<button
					type="button"
					:class="vb"
					:title="t('pptx.statusBar.zoomOut')"
					:aria-label="t('pptx.statusBar.zoomOut')"
					@click="emit('zoom-out')"
				>
					<Minus class="w-3 h-3" />
				</button>
				<button
					type="button"
					class="px-1.5 py-0.5 rounded-sm hover:bg-accent/60 text-[10px] text-muted-foreground tabular-nums min-w-[3rem] text-center transition-colors"
					:title="t('pptx.statusBar.zoomToFit')"
					@click="emit('zoom-to-fit')"
				>
					{{ Math.round((props.scale ?? 1) * 100) }}%
				</button>
				<button
					type="button"
					:class="vb"
					:title="t('pptx.statusBar.zoomIn')"
					:aria-label="t('pptx.statusBar.zoomIn')"
					@click="emit('zoom-in')"
				>
					<Plus class="w-3 h-3" />
				</button>
			</div>
		</template>
	</div>
</template>
