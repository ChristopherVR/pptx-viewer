<script lang="ts">
 import { RECORD_COMMAND_GROUPS } from 'pptx-viewer-shared';
 import { useTranslator } from '../../../../i18n/context';

 const { onfrombeginning, onfromcurrent }: { onfrombeginning: () => void; onfromcurrent: () => void } = $props();
 const t = useTranslator();
 function request(id: string): void {
  if (id === 'record.record.fromBeginning') {onfrombeginning();}
  else if (id === 'record.record.fromCurrent') {onfromcurrent();}
 }
</script>
{#each RECORD_COMMAND_GROUPS as group (group.id)}
 <pptx-ui-ribbon-group label={t(group.labelKey)} data-ribbon-group={group.id}>
  {#each group.commands as command (command.id)}
   <pptx-ui-ribbon-command label={t(command.labelKey)} icon={command.icon} disabled={command.unsupported || undefined}
    data-ribbon-control={command.id} oncommand-request={() => request(command.id)}></pptx-ui-ribbon-command>
  {/each}
 </pptx-ui-ribbon-group>
{/each}
