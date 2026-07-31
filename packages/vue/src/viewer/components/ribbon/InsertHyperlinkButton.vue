<script setup lang="ts">
/**
 * InsertHyperlinkButton: Insert > Link.
 *
 * Its own file rather than another block inside `InsertSection.vue`, which is
 * already well past the repo's 300-LOC budget. Vue shipped the hyperlink editor
 * (`HyperlinkDialog.vue`) and the context-menu entry that opens it, but never
 * the ribbon entry point PowerPoint puts on Insert, so the command existed
 * without a discoverable way to reach it.
 */
import { Link } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { ic, pill } from './ribbon-constants';

interface Props {
	/** Whether an element is selected; a link always attaches to something. */
	hasSelection: boolean;
	onOpenHyperlinkDialog: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();
</script>

<template>
	<button
		type="button"
		:disabled="!props.hasSelection"
		:class="pill"
		:title="t('pptx.hyperlinkDialog.title')"
		@click="props.onOpenHyperlinkDialog()"
	>
		<Link :class="ic" />
		{{ t('pptx.hyperlinkDialog.title') }}
	</button>
</template>
