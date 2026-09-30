<script setup lang="ts">
import { HELP_RIBBON_COMMANDS, isDialogAvailable } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useResolvedCustomization } from '../../composables/useViewerCustomization';
import type { HelpSectionProps } from './help-section-props';

const props = defineProps<HelpSectionProps>();
const { t } = useI18n();
const customization = useResolvedCustomization();
const commands = computed(() =>
	HELP_RIBBON_COMMANDS.filter(
		(command) =>
			command.id !== 'help.help.options' || isDialogAvailable(customization.value, 'options'),
	),
);
const actions = computed(() => ({
	'help.help.options': props.onOpenSettings ?? props.onToggleShortcuts,
	'help.help.keyboardShortcuts': props.onToggleShortcuts,
	'help.help.accessibility': props.onRunAccessibilityCheck,
}));
</script>

<template>
	<pptx-ui-ribbon-group :label="t('pptx.ribbon.tab.help')" data-ribbon-group="help.help">
		<pptx-ui-ribbon-command
			v-for="command in commands"
			:key="command.id"
			:data-ribbon-control="command.id"
			:label="t(command.labelKey)"
			:icon="command.icon"
			compact
			@command-request="actions[command.id as keyof typeof actions]()"
		></pptx-ui-ribbon-command>
	</pptx-ui-ribbon-group>
</template>
