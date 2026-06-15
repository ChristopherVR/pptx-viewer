<script setup lang="ts">
import { computed, ref } from 'vue';

import type { SlideVersion } from '../composables/useVersionHistory';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * VersionHistoryPanel — lists captured slide-version snapshots.
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
	(e: 'restore', id: string): void;
	(e: 'delete', id: string): void;
	(e: 'compare', id: string): void;
}>();

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

function formatTimestamp(ts: number): string {
	return new Date(ts).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function togglePreview(id: string): void {
	previewId.value = previewId.value === id ? null : id;
}
</script>

<template>
	<aside v-if="open" class="pptx-vue-version-panel">
		<header class="pptx-vue-version-header">
			<h3 class="pptx-vue-version-title">Version history</h3>
			<button
				type="button"
				class="pptx-vue-version-close"
				aria-label="Close"
				@click="emit('close')"
			>
				&times;
			</button>
		</header>

		<div class="pptx-vue-version-list">
			<p v-if="orderedVersions.length === 0" class="pptx-vue-version-empty">
				No versions saved yet
			</p>

			<div v-for="version in orderedVersions" :key="version.id" class="pptx-vue-version-item">
				<button type="button" class="pptx-vue-version-row" @click="togglePreview(version.id)">
					<span class="pptx-vue-version-caret">
						{{ previewId === version.id ? '▾' : '▸' }}
					</span>
					<span class="pptx-vue-version-meta">
						<span class="pptx-vue-version-label">{{ version.label }}</span>
						<span class="pptx-vue-version-sub">
							{{ formatTimestamp(version.timestamp) }} · {{ version.slideCount }}
							{{ version.slideCount === 1 ? 'slide' : 'slides' }}
						</span>
					</span>
				</button>

				<div v-if="previewId === version.id" class="pptx-vue-version-preview">
					<div
						v-if="version.slides.length > 0"
						class="pptx-vue-version-thumb"
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

				<div class="pptx-vue-version-actions">
					<button
						type="button"
						class="pptx-vue-version-btn pptx-vue-version-btn--primary"
						@click="emit('restore', version.id)"
					>
						Restore
					</button>
					<button type="button" class="pptx-vue-version-btn" @click="emit('compare', version.id)">
						Compare
					</button>
					<button
						type="button"
						class="pptx-vue-version-btn pptx-vue-version-btn--danger"
						@click="emit('delete', version.id)"
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	</aside>
</template>

<style scoped>
.pptx-vue-version-panel {
	position: absolute;
	top: 0;
	bottom: 0;
	right: 0;
	z-index: 50;
	display: flex;
	flex-direction: column;
	width: 320px;
	background: var(--pptx-vue-background, #ffffff);
	color: var(--pptx-vue-foreground, #111827);
	border-left: 1px solid var(--pptx-vue-border, #e5e7eb);
	box-shadow: -8px 0 32px rgba(0, 0, 0, 0.2);
}

.pptx-vue-version-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 14px;
	border-bottom: 1px solid var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-version-title {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
}

.pptx-vue-version-close {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	padding: 0;
	font-size: 18px;
	line-height: 1;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	background: transparent;
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-version-list {
	flex: 1;
	overflow-y: auto;
}

.pptx-vue-version-empty {
	margin: 0;
	padding: 32px 14px;
	text-align: center;
	font-size: 12px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-version-item {
	border-bottom: 1px solid var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-version-row {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 10px 14px;
	text-align: left;
	background: transparent;
	border: none;
	cursor: pointer;
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-version-caret {
	flex-shrink: 0;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-version-meta {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.pptx-vue-version-label {
	font-size: 12px;
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pptx-vue-version-sub {
	font-size: 10px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-version-preview {
	padding: 0 14px 8px;
}

.pptx-vue-version-thumb {
	overflow: hidden;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
}

.pptx-vue-version-actions {
	display: flex;
	gap: 6px;
	padding: 0 14px 10px;
}

.pptx-vue-version-btn {
	display: inline-flex;
	align-items: center;
	padding: 4px 10px;
	font-size: 11px;
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-muted, #f3f4f6);
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-version-btn--primary {
	color: #eff6ff;
	background: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-version-btn--danger {
	color: #b91c1c;
	background: rgba(239, 68, 68, 0.16);
}
</style>
