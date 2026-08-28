<script setup lang="ts">
/**
 * MotionPathGallery: the Animations tab's motion-path gallery, PowerPoint's
 * Lines / Arcs / Turns / Shapes / Loops families with every path a real button.
 *
 * It is a sibling of the entrance/emphasis/exit gallery rather than a fourth
 * column of it because a motion path is not one of those three buckets: it is
 * geometry that coexists with them on the same animation entry, so mixing it
 * into the preset columns would imply a choice the model does not make.
 *
 * Every path is a `<button>` in the accessibility tree rather than an entry
 * behind a hover menu: a gallery a screen-reader user cannot enumerate is a
 * gallery they do not have. The family captions are inert `<span>`s for the
 * mirrored reason, a caption that answers to a click is a control the tab does
 * not really offer.
 *
 * The columns are derived from the shared catalogue once at module scope, so a
 * preset added to `pptx-viewer-shared` reaches this binding with no follow-up
 * here and every binding's gallery stays identical by construction.
 */
import { MoveRight } from 'lucide-vue-next';
import {
	MOTION_PATH_FAMILIES,
	motionPathFamilyLabelKey,
	motionPathPresetLabelKey,
	motionPathPresetsByFamily,
} from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

interface Props {
	disabled: boolean;
	/** Applies a catalogue motion path to the selected element by preset id. */
	onApplyMotionPath?: (presetId: string) => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

/** One gallery column: a family's caption plus the paths that belong to it. */
const FAMILY_COLUMNS = MOTION_PATH_FAMILIES.map((family) => ({
	family,
	labelKey: motionPathFamilyLabelKey(family),
	presets: motionPathPresetsByFamily(family),
}));

/** A path's visible caption AND its tooltip, so both name the same control. */
function presetLabel(presetId: string): string {
	return t(motionPathPresetLabelKey(presetId));
}

/*
 * The root div below carries `max-w-[420px] overflow-x-auto`: matches the cap
 * React applies via the className on the RibbonGroup that wraps its
 * MotionPathGallery (`max-w-[420px] overflow-hidden`). Without a width cap
 * here, the five family columns (Lines/Arcs/Turns/Shapes/Loops), each already
 * capped individually at `max-w-[150px]`, still measured ~810px combined in
 * this binding (vs. React's own ~400px for the identical shared-catalogue
 * content), wide enough to push the Advanced Animation and Timing groups
 * after it off the ribbon's visible row: reachable only via a second,
 * easy-to-miss nested horizontal scrollbar (the reported Animations-tab
 * "clipping"). `overflow-x-auto` (rather than React's `overflow-hidden` on
 * its wrapper) keeps every family reachable via a small scrollbar instead of
 * silently hiding whatever a hard clip would cut off.
 *
 * The comment lives here, not inside <template>, because a comment placed
 * before the template's root element turns this component into a multi-root
 * fragment, which drops single-root $attrs inheritance and broke
 * MotionPathGallery.test.ts's `wrapper.attributes('aria-label')` lookup.
 */
</script>

<template>
	<div
		class="flex max-h-[62px] max-w-[420px] items-start gap-2 overflow-x-auto overflow-y-auto rounded-sm border border-border/60 bg-muted/30 px-1.5 py-1"
		:aria-label="t('pptx.animations.motionPathGalleryAria')"
	>
		<div v-for="column in FAMILY_COLUMNS" :key="column.family" class="flex flex-col gap-0.5">
			<span class="text-[9px] font-semibold leading-3 text-muted-foreground">
				{{ t(column.labelKey) }}
			</span>
			<div class="flex max-w-[150px] flex-wrap gap-0.5">
				<button
					v-for="preset in column.presets"
					:key="preset.id"
					type="button"
					:disabled="props.disabled"
					:title="presetLabel(preset.id)"
					class="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[9px] leading-3 text-foreground transition-colors hover:bg-accent disabled:opacity-35"
					@click="props.onApplyMotionPath?.(preset.id)"
				>
					<MoveRight class="h-2.5 w-2.5 text-sky-500" aria-hidden="true" />
					<span class="whitespace-nowrap">{{ presetLabel(preset.id) }}</span>
				</button>
			</div>
		</div>
	</div>
</template>
