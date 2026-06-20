<script setup lang="ts">
/**
 * CustomShowsControls: the Vue 3 port of React's `CustomShowsControls` from
 * `toolbar/CustomShowsControls.tsx`. Renders the custom-show selector and (when
 * editable) the +Show / Rename / Delete / Add-Slide controls. A faithful,
 * mechanical port for visual + behavioral parity: class strings are copied
 * verbatim, callbacks arrive as function props, and React's `sep` JSX becomes
 * `<div :class="SEP" />`.
 */
import type { PptxCustomShow } from 'pptx-viewer-core';

import { cn } from '../../../utils';
import { SEP } from './ribbon-constants';

interface Props {
	customShows: PptxCustomShow[];
	activeCustomShowId: string | null;
	canEdit: boolean;
	isCurrentSlideInActiveShow: boolean;
	onSetActiveCustomShowId: (id: string | null) => void;
	onCreateCustomShow: () => void;
	onRenameActiveCustomShow: () => void;
	onDeleteActiveCustomShow: () => void;
	onToggleCurrentSlideInActiveShow: () => void;
}

const props = defineProps<Props>();

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
			title="Custom show"
			aria-label="Select custom show"
			@change="onSelectChange"
		>
			<option value="">All Slides</option>
			<option v-for="cs in props.customShows" :key="cs.id" :value="cs.id">
				{{ cs.name }}
			</option>
		</select>
		<template v-if="props.canEdit">
			<button
				type="button"
				class="px-2 py-1 rounded bg-muted hover:bg-accent text-[11px] transition-colors"
				title="Create custom show"
				@click="props.onCreateCustomShow()"
			>
				+ Show
			</button>
			<template v-if="props.activeCustomShowId">
				<button
					type="button"
					class="px-2 py-1 rounded bg-muted hover:bg-accent text-[11px] transition-colors"
					title="Rename active custom show"
					@click="props.onRenameActiveCustomShow()"
				>
					Rename
				</button>
				<button
					type="button"
					class="px-2 py-1 rounded bg-red-700/80 hover:bg-red-600 text-[11px] transition-colors"
					title="Delete active custom show"
					@click="props.onDeleteActiveCustomShow()"
				>
					Delete
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
					title="Include/exclude current slide in active custom show"
					@click="props.onToggleCurrentSlideInActiveShow()"
				>
					{{ props.isCurrentSlideInActiveShow ? 'In Show' : 'Add Slide' }}
				</button>
			</template>
		</template>
	</template>
	<template v-else-if="props.canEdit">
		<div :class="SEP" />
		<button
			type="button"
			class="px-2 py-1 rounded bg-muted hover:bg-accent text-[11px] transition-colors"
			title="Create custom show"
			@click="props.onCreateCustomShow()"
		>
			+ Show
		</button>
	</template>
</template>
