<script setup lang="ts">
import { ChevronDown, ChevronRight, X } from 'lucide-vue-next';
import { formatVersionTimestamp as formatTimestamp } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { SlideVersion } from '../composables/useVersionHistory';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * VersionHistoryPanel - lists captured slide-version snapshots.
 *
 * Vue port of the React `VersionHistoryPanel.tsx`, adapted to the Vue port's
 * in-memory version model (the React panel read serialised blobs from the
 * autosave IndexedDB store; here the host supplies a reactive list of
 * {@link SlideVersion} snapshots from `useVersionHistory`).
 *
 * The user can preview a version's first slide (rendered via `SlideStage`),
 * restore it, delete it, or compare it against the current document. All
 * mutations are emitted to the host, which owns the version store.
 */
const props = defineProps<{
	/** Whether the panel is visible. */
	open: boolean;
	/** Captured versions, newest last. */
	versions: SlideVersion[];
	/** Canvas dimensions used to render version previews. */
	canvasSize: CanvasSize;
	/** Resolved media data URLs for preview rendering. */
	mediaDataUrls: Map<string, string>;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'restore' | 'delete' | 'compare', id: string): void;
}>();

const { t } = useI18n();

/** Id of the version currently expanded for preview, or `null`. */
const previewId = ref<string | null>(null);

/** Newest-first ordering for display (the store keeps newest last). */
const orderedVersions = computed(() => [...props.versions].reverse());

// Preview thumbnail scale: fit canvas width into the panel column.
const PREVIEW_WIDTH = 240;
const previewScale = computed(() =>
	props.canvasSize.width > 0 ? PREVIEW_WIDTH / props.canvasSize.width : 1,
);
const previewStyle = computed(() => ({
	width: `${PREVIEW_WIDTH}px`,
	height: `${props.canvasSize.height * previewScale.value}px`,
}));

function togglePreview(id: string): void {
	previewId.value = previewId.value === id ? null : id;
}
</script>

<template>
	<aside
		v-if="open"
		class="pptx-vue-version-panel absolute inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-border bg-background text-foreground shadow-xl"
	>
		<header
			class="pptx-vue-version-header flex items-center justify-between border-b border-border px-3.5 py-2.5"
		>
			<h3 class="pptx-vue-version-title m-0 text-sm font-semibold">
				{{ t('pptx.versionHistory.title') }}
			</h3>
			<button
				type="button"
				class="pptx-vue-version-close inline-flex h-6 w-6 items-center justify-center rounded p-0 text-lg leading-none text-muted-foreground hover:bg-accent hover:text-foreground"
				:aria-label="t('pptx.common.close')"
				@click="emit('close')"
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</button>
		</header>

		<div class="pptx-vue-version-list flex-1 overflow-y-auto">
			<p
				v-if="orderedVersions.length === 0"
				class="pptx-vue-version-empty m-0 px-3.5 py-8 text-center text-xs text-muted-foreground"
			>
				{{ t('pptx.versionHistory.noVersionsYet') }}
			</p>

			<div
				v-for="version in orderedVersions"
				:key="version.id"
				class="pptx-vue-version-item group border-b border-border"
			>
				<button
					type="button"
					class="pptx-vue-version-row flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3.5 py-2.5 text-left text-foreground"
					@click="togglePreview(version.id)"
				>
					<component
						:is="previewId === version.id ? ChevronDown : ChevronRight"
						class="pptx-vue-version-caret h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
					<span class="pptx-vue-version-meta flex min-w-0 flex-col gap-0.5">
						<span class="pptx-vue-version-label truncate text-xs font-medium">{{
							version.label
						}}</span>
						<span class="pptx-vue-version-sub text-[10px] text-muted-foreground">
							{{ formatTimestamp(version.timestamp) }} ·
							{{ t('pptx.versionHistory.slideCount', { count: version.slideCount }) }}
						</span>
					</span>
				</button>

				<div v-if="previewId === version.id" class="pptx-vue-version-preview px-3.5 pb-2">
					<div
						v-if="version.slides.length > 0"
						class="pptx-vue-version-thumb overflow-hidden rounded border border-border"
						:style="previewStyle"
					>
						<SlideStage
							:slide="version.slides[0]"
							:canvas-size="canvasSize"
							:media-data-urls="mediaDataUrls"
							:scale="previewScale"
						/>
					</div>
				</div>

				<div class="pptx-vue-version-actions flex gap-1.5 px-3.5 pb-2.5">
					<button
						type="button"
						class="pptx-vue-version-btn pptx-vue-version-btn--primary inline-flex cursor-pointer items-center rounded bg-primary/20 px-2.5 py-1 text-[11px] text-primary transition-colors hover:bg-primary/30"
						@click="emit('restore', version.id)"
					>
						{{ t('pptx.versionHistory.restore') }}
					</button>
					<button
						type="button"
						class="pptx-vue-version-btn inline-flex cursor-pointer items-center rounded bg-muted px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-accent"
						@click="emit('compare', version.id)"
					>
						{{ t('pptx.versionHistory.compare') }}
					</button>
					<button
						type="button"
						class="pptx-vue-version-btn pptx-vue-version-btn--danger inline-flex cursor-pointer items-center rounded bg-red-600/20 px-2.5 py-1 text-[11px] text-red-400 transition-colors hover:bg-red-600/30"
						@click="emit('delete', version.id)"
					>
						{{ t('pptx.common.delete') }}
					</button>
				</div>
			</div>
		</div>
	</aside>
</template>
