<script setup lang="ts">
/**
 * HelpSection: the Help ribbon tab (Keyboard Shortcuts + Accessibility
 * Check). Extracted from `RibbonToolbar.vue`'s inline `<template>` to keep
 * that file under the repo's ~300 LOC convention and match the one-component-
 * per-tab pattern the other sections already follow.
 */
import { useI18n } from 'vue-i18n';

import { pill } from './ribbon-constants';

interface Props {
	onToggleShortcuts: () => void;
	onRunAccessibilityCheck: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();
</script>

<template>
	<button
		type="button"
		:class="pill"
		:title="t('pptx.settings.keyboardShortcuts')"
		@click="props.onToggleShortcuts()"
	>
		{{ t('pptx.settings.keyboardShortcuts') }}
	</button>
	<button
		type="button"
		:class="pill"
		:title="t('pptx.ribbon.accessibilityCheck')"
		@click="props.onRunAccessibilityCheck()"
	>
		{{ t('pptx.ribbon.accessibility') }}
	</button>
</template>
