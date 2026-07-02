<script setup lang="ts">
import { PenTool, Trash2 } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

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
					t('pptx.keepAnnotations.body', {
						count: props.annotationCount,
						slideCount: props.slideCount,
					})
				}}
			</p>
		</div>

		<template #footer>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				@click="emit('discard')"
			>
				<Trash2 class="h-4 w-4" />
				{{ t('pptx.keepAnnotations.discard') }}
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
				@click="emit('keep')"
			>
				<PenTool class="h-4 w-4" />
				{{ t('pptx.keepAnnotations.keep') }}
			</button>
		</template>
	</ModalDialog>
</template>
