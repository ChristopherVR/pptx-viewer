<script lang="ts">
	import { HELP_RIBBON_COMMANDS } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import type { HelpTabProps } from './help-tab-props';

	const props: HelpTabProps = $props();
	const t = useTranslator();
	const actions = $derived({
		'help.help.options': props.onsettings,
		'help.help.keyboardShortcuts': props.onshortcuts,
		'help.help.accessibility': props.onaccessibility,
	});
</script>

<pptx-ui-ribbon-group label={t('pptx.ribbon.tab.help')} data-ribbon-group="help.help">
	{#each HELP_RIBBON_COMMANDS as command (command.id)}
		{#if command.id !== 'help.help.options' || props.onsettings}
			<pptx-ui-ribbon-command data-ribbon-control={command.id} label={t(command.labelKey)} icon={command.icon} compact
				oncommand-request={() => actions[command.id as keyof typeof actions]?.()}
			></pptx-ui-ribbon-command>
		{/if}
	{/each}
</pptx-ui-ribbon-group>
