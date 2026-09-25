<script setup lang="ts">
/**
 * CropControls: the Arrange group's picture "Crop" toggle plus its dropdown
 * (Crop to Aspect Ratio presets, Fill, Fit). The toggle enters/commits the
 * on-canvas crop mode; the menu entries apply one undoable crop each. All
 * geometry and labels are shared (`pptx-viewer-shared`'s picture-crop
 * module); the actions are the injected crop controller (`usePictureCrop`).
 *
 * The wrapper carries `data-pptx-crop-keep` so a pointer-down on these
 * controls does not count as "clicked outside" and commit crop mode before
 * the toggle/menu itself gets to act.
 */
import { ChevronDown, Crop } from 'lucide-vue-next';
import {
	CROP_ASPECT_GROUP_LABEL_KEYS,
	CROP_ASPECT_LABEL_KEY,
	CROP_ASPECT_PRESETS,
	CROP_FILL_LABEL_KEY,
	CROP_FIT_LABEL_KEY,
	CROP_LABEL_KEY,
} from 'pptx-viewer-shared';
import type { CropAspectGroup } from 'pptx-viewer-shared';
import { computed, inject, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { MergeCropKey } from '../../composables/merge-crop-context';
import { vAnchoredPopup } from './anchored-popup';
import { gB, gL, grp, ic, MENU_ITEM, MENU_PANEL } from './ribbon-constants';
import { useDropdown } from './use-dropdown';

const { t } = useI18n();
const controller = inject(MergeCropKey, undefined);
const menu = useDropdown();
/** The trigger the popup hangs below (not the wrapper, which contains the popup). */
const trigger = useTemplateRef<HTMLElement>('trigger');

const active = computed(() => Boolean(controller?.cropActive.value));
const enabled = computed(() => active.value || Boolean(controller?.canCrop.value));
const title = computed(() => (enabled.value ? t(CROP_LABEL_KEY) : t('pptx.image.cropHint')));

const GROUPS: CropAspectGroup[] = ['square', 'portrait', 'landscape'];
const groups = GROUPS.map((group) => ({
	group,
	presets: CROP_ASPECT_PRESETS.filter((p) => p.group === group),
}));

function pick(action: () => void): void {
	menu.close();
	action();
}
</script>

<template>
	<div :ref="menu.root" class="relative" data-pptx-crop-keep="true">
		<div ref="trigger" :class="grp">
			<button
				type="button"
				:class="cn(gB, active && 'bg-primary text-white')"
				:disabled="!enabled"
				data-pptx-ribbon-control="crop"
				:aria-pressed="active ? 'true' : 'false'"
				:aria-label="t(CROP_LABEL_KEY)"
				:title="title"
				@click="controller?.toggleCrop()"
			>
				<Crop :class="ic" />
			</button>
			<button
				type="button"
				:class="gL"
				:disabled="!enabled"
				data-pptx-ribbon-control="crop-menu"
				aria-haspopup="menu"
				:aria-expanded="menu.open.value ? 'true' : 'false'"
				:aria-label="t(CROP_ASPECT_LABEL_KEY)"
				:title="enabled ? t(CROP_ASPECT_LABEL_KEY) : t('pptx.image.cropHint')"
				@click="menu.toggle()"
			>
				<ChevronDown class="w-3 h-3" />
			</button>
		</div>
		<div
			v-if="menu.open.value && enabled"
			class="z-50 flex flex-col w-44 pt-1"
			v-anchored-popup="{ anchor: trigger }"
		>
			<div
				:class="cn(MENU_PANEL, 'max-h-[70vh]')"
				role="menu"
				:aria-label="t(CROP_ASPECT_LABEL_KEY)"
			>
				<template v-for="g in groups" :key="g.group">
					<div
						role="presentation"
						class="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase text-muted-foreground"
					>
						{{ t(CROP_ASPECT_GROUP_LABEL_KEYS[g.group]) }}
					</div>
					<button
						v-for="p in g.presets"
						:key="p.id"
						type="button"
						role="menuitem"
						:class="MENU_ITEM"
						:data-pptx-crop-aspect="p.id"
						@click="pick(() => controller?.applyAspect(p.id))"
					>
						{{ p.id }}
					</button>
				</template>
				<div role="separator" class="my-1 border-t border-border/60" />
				<button
					type="button"
					role="menuitem"
					:class="MENU_ITEM"
					data-pptx-crop-action="fill"
					@click="pick(() => controller?.applyFill())"
				>
					{{ t(CROP_FILL_LABEL_KEY) }}
				</button>
				<button
					type="button"
					role="menuitem"
					:class="MENU_ITEM"
					data-pptx-crop-action="fit"
					@click="pick(() => controller?.applyFit())"
				>
					{{ t(CROP_FIT_LABEL_KEY) }}
				</button>
			</div>
		</div>
	</div>
</template>
