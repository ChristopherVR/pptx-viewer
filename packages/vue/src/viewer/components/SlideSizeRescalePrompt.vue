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

import DialogFooter from './DialogFooter.vue';
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
			<DialogFooter
				:actions="[
					{
						id: 'maximize',
						label: t('pptx.slideSize.rescaleMaximize'),
						title: t('pptx.slideSize.rescaleMaximizeHint'),
						testId: 'pptx-slide-size-rescale-maximize',
					},
					{
						id: 'ensureFit',
						label: t('pptx.slideSize.rescaleEnsureFit'),
						title: t('pptx.slideSize.rescaleEnsureFitHint'),
						variant: 'primary',
						testId: 'pptx-slide-size-rescale-ensure-fit',
					},
				]"
				@action="(id) => emit('choose', id === 'maximize' ? 'maximize' : 'ensureFit')"
			/>
		</template>
	</ModalDialog>
</template>
