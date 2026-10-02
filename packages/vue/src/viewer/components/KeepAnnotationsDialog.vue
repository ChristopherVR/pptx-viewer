<script setup lang="ts">
import { PenTool } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import DialogFooter from './DialogFooter.vue';
import ModalDialog from './ModalDialog.vue';

const { t } = useI18n();

/**
 * KeepAnnotationsDialog: shown when the presenter exits a slide show that still
 * has ink annotations. Offers to persist the annotations as ink elements on
 * their slides, or discard them. Vue port of the React `KeepAnnotationsDialog.tsx`.
 */
const props = defineProps<{
	open: boolean;
	annotationCount: number;
	slideCount: number;
}>();

const emit = defineEmits<{
	keep: [];
	discard: [];
}>();
</script>

<template>
	<ModalDialog :open="props.open" :title="t('pptx.keepAnnotations.title')" @close="emit('discard')">
		<div class="flex items-start gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
				<PenTool class="h-5 w-5 text-primary" />
			</div>
			<p class="text-sm text-muted-foreground">
				{{
					t('pptx.keepAnnotations.description', {
						count: props.annotationCount,
						slides: props.slideCount,
					})
				}}
			</p>
		</div>

		<template #footer>
			<DialogFooter
				:actions="[
					{ id: 'discard', label: t('pptx.keepAnnotations.discard'), icon: 'trash' },
					{ id: 'keep', label: t('pptx.keepAnnotations.keep'), variant: 'primary', icon: 'pen' },
				]"
				@action="(id) => (id === 'keep' ? emit('keep') : emit('discard'))"
			/>
		</template>
	</ModalDialog>
</template>
