<script setup lang="ts">
/**
 * HelpSection: the Help ribbon tab (Settings + Keyboard Shortcuts +
 * Accessibility Check). Extracted from `RibbonToolbar.vue`'s inline
 * `<template>` to keep that file under the repo's ~300 LOC convention and match
 * the one-component-per-tab pattern the other sections already follow.
 */
import { useI18n } from 'vue-i18n';

import { pill } from './ribbon-constants';

interface Props {
	/** Opens the File > Options dialog; falls back to the shortcuts sheet when unwired. */
	onOpenSettings?: () => void;
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
		:title="t('pptx.settings.title')"
		@click="(props.onOpenSettings ?? props.onToggleShortcuts)()"
	>
		{{ t('pptx.settings.title') }}
	</button>
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
		{{ t('pptx.ribbon.accessibilityCheck') }}
	</button>
</template>
