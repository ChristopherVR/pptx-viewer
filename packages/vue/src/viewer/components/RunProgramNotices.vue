<script setup lang="ts">
/**
 * RunProgramNotices: the non-blocking toast stack shown during a running show
 * when an on-slide Action Setting resolves to PowerPoint's "Run program"
 * (`ppaction://program`) verb. A browser cannot launch a local executable, so
 * `PresentationMode.vue`'s `runProgram` runner callback (via
 * `useRunProgramNotices`) pushes one of these instead of doing nothing
 * silently or blocking the show with a native `confirm`/`alert`.
 *
 * Visually mirrors `CompatibilityToasts.vue` (same stack positioning, via the
 * shared `compatToastStackStyle`), kept as a sibling component rather than a
 * mode of that one because the two toast shapes differ (severity/code vs. a
 * resolved command string) and `CompatibilityToasts` only ever renders inside
 * the editor chrome, never during a running show, so the two stacks never
 * compete for the same screen.
 */
import { X } from 'lucide-vue-next';
import type { RunProgramNotice } from 'pptx-viewer-shared';
import { canUseClipboard, compatToastStackStyle } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	notices: RunProgramNotice[];
}>();

const emit = defineEmits<{
	dismiss: [id: string];
}>();

const { t } = useI18n();

const clipboardAvailable = canUseClipboard(
	typeof navigator === 'undefined' ? undefined : navigator,
);

async function copyTarget(target: string): Promise<void> {
	if (!clipboardAvailable) {
		return;
	}
	try {
		await navigator.clipboard.writeText(target);
	} catch {
		// Clipboard permission can still be refused at call time even when the
		// API is present; the notice itself already shows the command, so a
		// failed copy is silently a no-op rather than a second, blocking error.
	}
}
</script>

<template>
	<div
		v-if="props.notices.length > 0"
		class="pptx-vue-run-program-notices max-w-[90vw]"
		data-testid="pptx-run-program-notices"
		:style="compatToastStackStyle()"
	>
		<div
			v-for="notice in props.notices"
			:key="notice.id"
			class="pptx-vue-run-program-notice pointer-events-auto flex items-start gap-2 rounded-md border border-border bg-popover p-2.5 text-xs shadow-lg"
			data-testid="pptx-run-program-notice"
			:data-target="notice.target"
		>
			<p class="flex-1 text-foreground">
				{{ t(notice.messageKey, { target: notice.target }) }}
			</p>
			<button
				v-if="clipboardAvailable"
				type="button"
				data-testid="pptx-run-program-notice-copy"
				class="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
				@click="copyTarget(notice.target)"
			>
				{{ t(notice.copyLabelKey) }}
			</button>
			<button
				type="button"
				data-testid="pptx-run-program-notice-dismiss"
				:aria-label="t('pptx.compatibility.dismiss')"
				class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
				@click="emit('dismiss', notice.id)"
			>
				<X class="h-3.5 w-3.5" aria-hidden="true" />
			</button>
		</div>
	</div>
</template>
