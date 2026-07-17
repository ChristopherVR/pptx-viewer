<script setup lang="ts">
/**
 * TagsSection: collapsible TAGS card in the no-selection inspector Properties
 * tab, mirroring React's `inspector/TagsSection.tsx` (collapsed by default,
 * flattened name/value rows across every `ppt/tags/tag*.xml` collection,
 * editable in place with per-row delete plus an Add-tag button when editing
 * is allowed).
 */
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-vue-next';
import type { PptxTagCollection } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { BTN, CARD, HEADING, INPUT } from './inspector-cards';

const props = withDefaults(
	defineProps<{
		tagCollections: PptxTagCollection[];
		canEdit?: boolean;
	}>(),
	{ canEdit: true },
);

const emit = defineEmits<{
	update: [next: PptxTagCollection[]];
}>();

const { t } = useI18n();

/** Collapsed by default, matching React. */
const collapsed = ref(true);

interface FlatTag {
	name: string;
	value: string;
	colIdx: number;
	tagIdx: number;
}

const allTags = computed<FlatTag[]>(() =>
	props.tagCollections.flatMap((col, colIdx) =>
		col.tags.map((tag, tagIdx) => ({ ...tag, colIdx, tagIdx })),
	),
);

function updateTag(
	colIdx: number,
	tagIdx: number,
	field: 'name' | 'value',
	newValue: string,
): void {
	const next = props.tagCollections.map((col, ci) => {
		if (ci !== colIdx) {
			return col;
		}
		return {
			...col,
			tags: col.tags.map((tag, ti) => (ti === tagIdx ? { ...tag, [field]: newValue } : tag)),
		};
	});
	emit('update', next);
}

function deleteTag(colIdx: number, tagIdx: number): void {
	const next = props.tagCollections.map((col, ci) => {
		if (ci !== colIdx) {
			return col;
		}
		return {
			...col,
			tags: col.tags.filter((_, ti) => ti !== tagIdx),
		};
	});
	emit('update', next);
}

function addTag(): void {
	if (props.tagCollections.length === 0) {
		emit('update', [{ path: 'ppt/tags/tag1.xml', tags: [{ name: '', value: '' }] }]);
		return;
	}
	const next = props.tagCollections.map((col, ci) => {
		if (ci !== 0) {
			return col;
		}
		return { ...col, tags: [...col.tags, { name: '', value: '' }] };
	});
	emit('update', next);
}
</script>

<template>
	<div :class="CARD">
		<button type="button" class="flex items-center gap-1 w-full" @click="collapsed = !collapsed">
			<ChevronRight v-if="collapsed" class="w-3 h-3 text-muted-foreground" />
			<ChevronDown v-else class="w-3 h-3 text-muted-foreground" />
			<span :class="HEADING">{{ t('pptx.tags.title') }}</span>
			<span class="ml-auto text-[10px] text-muted-foreground">{{ allTags.length }}</span>
		</button>
		<div v-if="!collapsed" class="space-y-1.5">
			<div v-if="allTags.length === 0" class="text-[10px] text-muted-foreground">
				{{ t('pptx.tags.noTags') }}
			</div>
			<template v-else>
				<div
					v-for="(tag, idx) in allTags"
					:key="`${tag.colIdx}-${tag.tagIdx}-${idx}`"
					class="grid grid-cols-[1fr,1fr,auto] gap-1 text-[11px]"
				>
					<input
						type="text"
						:class="INPUT"
						:disabled="!props.canEdit"
						:placeholder="t('pptx.tags.name')"
						:value="tag.name"
						@input="
							(e) => updateTag(tag.colIdx, tag.tagIdx, 'name', (e.target as HTMLInputElement).value)
						"
					/>
					<input
						type="text"
						:class="INPUT"
						:disabled="!props.canEdit"
						:placeholder="t('pptx.tags.value')"
						:value="tag.value"
						@input="
							(e) =>
								updateTag(tag.colIdx, tag.tagIdx, 'value', (e.target as HTMLInputElement).value)
						"
					/>
					<button
						v-if="props.canEdit"
						type="button"
						:class="[BTN, 'px-1.5 text-red-400 hover:text-red-300']"
						:title="t('pptx.tags.deleteTag')"
						@click="deleteTag(tag.colIdx, tag.tagIdx)"
					>
						<Trash2 class="w-3 h-3" />
					</button>
				</div>
			</template>
			<button v-if="props.canEdit" type="button" :class="BTN" @click="addTag">
				{{ t('pptx.tags.addTag') }}
			</button>
		</div>
	</div>
</template>
