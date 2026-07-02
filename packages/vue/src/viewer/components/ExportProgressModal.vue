<script setup lang="ts">
import { clampPercent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * ExportProgressModal - a centered, non-dismissable overlay shown while a
 * multi-slide export (PDF / GIF / WebM) runs. Vue counterpart of the React
 * `ExportProgressModal`.
 *
 * It deliberately does NOT close on backdrop click or Escape: an export in
 * flight should only end by completing, erroring, or the user pressing Cancel.
 * Cancel emits `cancel`; the parent owns cooperative cancellation (aborting the
 * `AbortController` the export loop checks between slides) and clearing `open`.
 *
 * Presentational only - the parent supplies `open`, `title`, `progress`
 * (0-100), and an optional `statusMessage`.
 */
const props = defineProps<{
	/** Whether the overlay is visible. */
	open: boolean;
	/** Heading shown at the top (e.g. "Export as PDF"). */
	title: string;
	/** Current progress, 0-100. */
	progress: number;
	/** Optional status line (e.g. "Rendering slide 3 of 10..."). */
	statusMessage?: string;
}>();

const emit = defineEmits<{
	(e: 'cancel'): void;
}>();

const { t } = useI18n();

const clampedProgress = computed(() => clampPercent(props.progress));

function onCancel(): void {
	emit('cancel');
}
</script>

<template>
	<Teleport to="body">
		<div
			v-if="open"
			class="pptx-vue-export-progress-backdrop fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			:aria-label="title"
		>
			<div
				class="pptx-vue-export-progress-panel w-[min(92vw,384px)] rounded-xl border border-border bg-popover p-6 text-foreground shadow-2xl"
			>
				<h3 class="mb-4 text-sm font-semibold">{{ title }}</h3>

				<div class="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
					<div
						class="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
						:style="{ width: `${clampedProgress}%` }"
					/>
				</div>

				<div class="mb-4 flex items-center justify-between text-xs text-muted-foreground">
					<span>{{ statusMessage ?? t('pptx.export.processing') }}</span>
					<span class="tabular-nums">{{ clampedProgress }}%</span>
				</div>

				<div class="flex justify-end">
					<button
						type="button"
						class="rounded-md border border-border bg-muted px-4 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
						@click="onCancel"
					>
						{{ t('pptx.export.cancel') }}
					</button>
				</div>
			</div>
		</div>
	</Teleport>
</template>
