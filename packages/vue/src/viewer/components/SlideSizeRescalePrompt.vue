<script setup lang="ts">
/**
 * SlideSizeRescalePrompt: PowerPoint's "Maximize / Ensure Fit" choice, shown
 * when a Design > Slide Size change would leave existing content mismatched
 * against the new canvas. The two decisions (what to show, what each choice
 * does to every slide's elements) both live in shared
 * (`slide-size-rescale.ts`); this component only renders the two buttons and
 * forwards the pick to `useInspectorDeckActions().chooseSlideSizeRescale`.
 */
import type { SlideSizeRescaleMode } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';

const props = defineProps<{
	open: boolean;
}>();

const emit = defineEmits<{
	choose: [mode: SlideSizeRescaleMode];
	close: [];
}>();

const { t } = useI18n();
</script>

<template>
	<ModalDialog
		:open="props.open"
		:title="t('pptx.slideSize.rescaleTitle')"
		marker-attr="data-pptx-slide-size-rescale"
		@close="emit('close')"
	>
		<p class="text-sm text-muted-foreground">{{ t('pptx.slideSize.rescaleDescription') }}</p>

		<template #footer>
			<button
				type="button"
				data-testid="pptx-slide-size-rescale-maximize"
				:title="t('pptx.slideSize.rescaleMaximizeHint')"
				class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				@click="emit('choose', 'maximize')"
			>
				{{ t('pptx.slideSize.rescaleMaximize') }}
			</button>
			<button
				type="button"
				data-testid="pptx-slide-size-rescale-ensure-fit"
				:title="t('pptx.slideSize.rescaleEnsureFitHint')"
				class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
				@click="emit('choose', 'ensureFit')"
			>
				{{ t('pptx.slideSize.rescaleEnsureFit') }}
			</button>
		</template>
	</ModalDialog>
</template>
