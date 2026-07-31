<script setup lang="ts">
/**
 * MotionPathRow: the animation panel's motion-path row. Pick a catalogue path,
 * clear it, or see that the applied path was hand-dragged.
 *
 * A dragged path no longer matches any catalogue entry, so it is surfaced as a
 * selected "Custom Path" option rather than silently snapping the select back
 * to the preset it started from, which would misreport what will play. That
 * option only exists while such a path is applied, so it can never be chosen
 * as a destination.
 *
 * The row is separate from the entrance/emphasis/exit selects because a motion
 * path is geometry that coexists with them on the same animation entry, not a
 * fourth preset bucket competing with them.
 */
import {
	MOTION_PATH_FAMILIES,
	motionPathFamilyLabelKey,
	motionPathPresetIdForPath,
	motionPathPresetLabelKey,
	motionPathPresetsByFamily,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
	defineProps<{
		/** The path currently applied to the selected element, if any. */
		motionPath?: string;
		canEdit?: boolean;
	}>(),
	{ motionPath: undefined, canEdit: true },
);

const emit = defineEmits<{
	/** A catalogue preset id, `'none'` to clear, or `'custom'` (a no-op marker). */
	change: [presetId: string];
}>();

const { t } = useI18n();

/** One optgroup per PowerPoint family, built once from the shared catalogue. */
const FAMILY_GROUPS = MOTION_PATH_FAMILIES.map((family) => ({
	family,
	labelKey: motionPathFamilyLabelKey(family),
	presets: motionPathPresetsByFamily(family),
}));

const presetId = computed(() => motionPathPresetIdForPath(props.motionPath));
const isCustom = computed(() => Boolean(props.motionPath) && !presetId.value);
const selected = computed(() => (isCustom.value ? 'custom' : (presetId.value ?? 'none')));

function onChange(event: Event): void {
	emit('change', (event.target as HTMLSelectElement).value);
}
</script>

<template>
	<label class="pptx-vue-motion-path-row flex flex-col gap-1">
		<span class="text-muted-foreground text-[11px]">{{
			t('pptx.animation.motionPath.label')
		}}</span>
		<select
			:value="selected"
			:disabled="!props.canEdit"
			:aria-label="t('pptx.animation.motionPath.label')"
			@change="onChange"
		>
			<option value="none">{{ t('pptx.animation.motionPath.none') }}</option>
			<option v-if="isCustom" value="custom">{{ t('pptx.animation.motionPath.custom') }}</option>
			<optgroup v-for="group in FAMILY_GROUPS" :key="group.family" :label="t(group.labelKey)">
				<option v-for="preset in group.presets" :key="preset.id" :value="preset.id">
					{{ t(motionPathPresetLabelKey(preset.id)) }}
				</option>
			</optgroup>
		</select>
		<span v-if="props.motionPath" class="text-[10px] text-muted-foreground">
			{{ t('pptx.animation.motionPath.editHint') }}
		</span>
	</label>
</template>

<style scoped>
select {
	box-sizing: border-box;
	width: 100%;
	border: 1px solid var(--border);
	border-radius: 3px;
	background: var(--muted);
	color: inherit;
	padding: 4px 6px;
}
</style>
