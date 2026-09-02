<script setup lang="ts">
/**
 * MasterViewCrudRow: the Slide Master view sidebar's Insert/Duplicate/
 * Delete/Rename Layout and Slide Master buttons.
 *
 * One button per `masterViewCrudActions` entry (`pptx-viewer-shared`), which
 * already decides enabled/disabled and why (a layout still used by a slide,
 * the presentation's last remaining master), so this row never re-derives
 * PowerPoint's own rules. Split out of `MasterViewSidebar.vue` to keep that
 * file under the repo's ~300 LOC convention.
 */
import type { MasterViewCrudAction, MasterViewCrudActionId } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

defineProps<{
	actions: MasterViewCrudAction[];
	/** i18n message for the last command's failure, or null/undefined. */
	error?: string | null;
}>();

const emit = defineEmits<{
	run: [id: MasterViewCrudActionId];
}>();

const { t } = useI18n();
</script>

<template>
	<section v-if="actions.length > 0" class="pptx-vue-master-crud">
		<button
			v-for="action in actions"
			:key="action.id"
			type="button"
			class="pptx-vue-master-crud__btn"
			:disabled="!action.enabled"
			:title="action.disabledReasonKey ? t(action.disabledReasonKey) : undefined"
			:data-testid="`pptx-master-crud-${action.id}`"
			@click="emit('run', action.id)"
		>
			{{ t(action.labelKey) }}
		</button>
		<p v-if="error" class="pptx-vue-master-crud__error" role="alert">
			{{ error }}
		</p>
	</section>
</template>

<style scoped>
.pptx-vue-master-crud {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	margin-bottom: 8px;
}

.pptx-vue-master-crud__btn {
	padding: 3px 6px;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
	background: transparent;
	color: var(--pptx-vue-foreground, #111827);
	font-size: 10px;
	cursor: pointer;
}

.pptx-vue-master-crud__btn:hover:not(:disabled) {
	background: var(--pptx-vue-muted, #f3f4f6);
}

.pptx-vue-master-crud__btn:disabled {
	color: var(--pptx-vue-muted-foreground, #9ca3af);
	cursor: not-allowed;
	opacity: 0.6;
}

.pptx-vue-master-crud__error {
	flex-basis: 100%;
	margin: 4px 0 0;
	font-size: 10px;
	color: #ef4444;
}
</style>
