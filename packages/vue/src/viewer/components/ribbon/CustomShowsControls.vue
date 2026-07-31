<script setup lang="ts">
/**
 * CustomShowsControls: the Vue 3 port of React's `CustomShowsControls` from
 * `toolbar/CustomShowsControls.tsx`. Renders the custom-show selector and (when
 * editable) the +Show / Rename / Delete / Add-Slide controls. A faithful,
 * mechanical port for visual + behavioral parity: class strings are copied
 * verbatim, callbacks arrive as function props, and React's `sep` JSX becomes
 * `<div :class="SEP" />`.
 */
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { SEP } from './ribbon-constants';
import type { CustomShowsControlsProps } from './ribbon-types';

interface Props extends CustomShowsControlsProps {}

const props = defineProps<Props>();
const { t } = useI18n();

function onSelectChange(e: Event): void {
	const value = (e.target as HTMLSelectElement).value;
	props.onSetActiveCustomShowId(value || null);
}
</script>

<template>
	<template v-if="props.customShows.length > 0">
		<div :class="SEP" />
		<select
			:value="props.activeCustomShowId ?? ''"
			class="h-6 px-1.5 text-[11px] rounded bg-muted text-foreground border border-border hover:bg-accent transition-colors cursor-pointer"
			:title="t('pptx.customShows.customShowTooltip')"
			:aria-label="t('pptx.customShows.selectCustomShow')"
			@change="onSelectChange"
		>
			<option value="">{{ t('pptx.customShows.allSlides') }}</option>
			<option v-for="cs in props.customShows" :key="cs.id" :value="cs.id">
				{{ cs.name }}
			</option>
		</select>
		<template v-if="props.canEdit">
			<button
				type="button"
				class="px-2 py-1 rounded bg-muted hover:bg-accent text-[11px] transition-colors"
				:title="t('pptx.customShows.createTooltip')"
				@click="props.onCreateCustomShow()"
			>
				{{ t('pptx.customShows.addShow') }}
			</button>
			<template v-if="props.activeCustomShowId">
				<button
					type="button"
					class="px-2 py-1 rounded bg-muted hover:bg-accent text-[11px] transition-colors"
					:title="t('pptx.customShows.renameTooltip')"
					@click="props.onRenameActiveCustomShow()"
				>
					{{ t('pptx.sections.rename') }}
				</button>
				<button
					type="button"
					class="px-2 py-1 rounded bg-red-700/80 hover:bg-red-600 text-[11px] transition-colors"
					:title="t('pptx.customShows.deleteTooltip')"
					@click="props.onDeleteActiveCustomShow()"
				>
					{{ t('pptx.sections.delete') }}
				</button>
				<button
					type="button"
					:class="
						cn(
							'px-2 py-1 rounded text-[11px] transition-colors',
							props.isCurrentSlideInActiveShow
								? 'bg-primary text-white'
								: 'bg-muted hover:bg-accent',
						)
					"
					:title="t('pptx.customShows.toggleSlideTooltip')"
					@click="props.onToggleCurrentSlideInActiveShow()"
				>
					{{
						props.isCurrentSlideInActiveShow
							? t('pptx.customShows.inShow')
							: t('pptx.customShows.addSlide')
					}}
				</button>
			</template>
		</template>
	</template>
	<template v-else-if="props.canEdit">
		<div :class="SEP" />
		<button
			type="button"
			class="px-2 py-1 rounded bg-muted hover:bg-accent text-[11px] transition-colors"
			:title="t('pptx.customShows.createTooltip')"
			@click="props.onCreateCustomShow()"
		>
			{{ t('pptx.customShows.addShow') }}
		</button>
	</template>
</template>
