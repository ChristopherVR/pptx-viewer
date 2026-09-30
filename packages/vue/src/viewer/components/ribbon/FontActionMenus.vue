<script setup lang="ts">
import { CHARACTER_SPACING_OPTIONS, CHANGE_CASE_OPTIONS } from 'pptx-viewer-shared';
import type { ChangeCaseMode } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { vAnchoredPopup } from './anchored-popup';
import { ic, MENU_ITEM, MENU_PANEL, pill } from './ribbon-constants';
import RibbonIcon from './RibbonIcon';
import { useDropdown } from './use-dropdown';

const props = defineProps<{ disabled: boolean }>();
const emit = defineEmits<{ spacing: [value: number]; case: [value: ChangeCaseMode] }>();
const { t } = useI18n();
const spacingMenu = useDropdown();
const caseMenu = useDropdown();
</script>
<template>
	<div :ref="spacingMenu.root" class="relative" data-ribbon-control="home.font.characterSpacing">
		<button
			type="button"
			:disabled="props.disabled"
			:class="pill"
			:title="t('pptx.text.characterSpacing')"
			@mousedown.prevent
			@click="spacingMenu.toggle()"
		>
			<RibbonIcon name="home.font.characterSpacing" :class="ic" />
		</button>
		<div
			v-if="spacingMenu.open.value"
			class="z-50 flex flex-col w-36 pt-1"
			v-anchored-popup="{ anchor: spacingMenu.root.value }"
		>
			<div :class="MENU_PANEL">
				<button
					v-for="option in CHARACTER_SPACING_OPTIONS"
					:key="option.value"
					type="button"
					:class="MENU_ITEM"
					@click="
						emit('spacing', option.value * 2);
						spacingMenu.close();
					"
				>
					{{ t(option.i18nKey) }}
				</button>
			</div>
		</div>
	</div>
	<div :ref="caseMenu.root" class="relative" data-ribbon-control="home.font.changeCase">
		<button
			type="button"
			:disabled="props.disabled"
			:class="pill"
			:title="t('pptx.text.changeCase')"
			:aria-label="t('pptx.text.changeCase')"
			@mousedown.prevent
			@click="caseMenu.toggle()"
		>
			<RibbonIcon name="home.font.changeCase" :class="ic" />
		</button>
		<div
			v-if="caseMenu.open.value"
			class="z-50 flex flex-col w-44 pt-1"
			v-anchored-popup="{ anchor: caseMenu.root.value }"
		>
			<div :class="MENU_PANEL">
				<button
					v-for="option in CHANGE_CASE_OPTIONS"
					:key="option.value"
					type="button"
					:class="MENU_ITEM"
					@click="
						emit('case', option.value);
						caseMenu.close();
					"
				>
					{{ t(option.i18nKey) }}
				</button>
			</div>
		</div>
	</div>
</template>
