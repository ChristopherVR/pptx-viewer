<script setup lang="ts">
import { RECORD_COMMAND_GROUPS } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ onRecordFromBeginning: () => void; onRecordFromCurrent: () => void }>();
const { t } = useI18n();
function request(id: string): void {
	if (id === 'record.record.fromBeginning') {
		props.onRecordFromBeginning();
	} else if (id === 'record.record.fromCurrent') {
		props.onRecordFromCurrent();
	}
}
</script>
<template>
	<pptx-ui-ribbon-group
		v-for="group in RECORD_COMMAND_GROUPS"
		:key="group.id"
		:label="t(group.labelKey)"
		:data-ribbon-group="group.id"
	>
		<pptx-ui-ribbon-command
			v-for="command in group.commands"
			:key="command.id"
			:label="t(command.labelKey)"
			:icon="command.icon"
			:disabled="command.unsupported || undefined"
			:data-ribbon-control="command.id"
			@command-request="request(command.id)"
		></pptx-ui-ribbon-command>
	</pptx-ui-ribbon-group>
</template>
