<script setup lang="ts">
import type {
	PptxAnimationTimelineAnchor,
	PptxElement,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties, isImageLikeElement } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import ActionSettingsPanel from './ActionSettingsPanel.vue';
import AnimationPanel from './AnimationPanel.vue';
import ArrangePanel from './ArrangePanel.vue';
import ChartPanel from './ChartPanel.vue';
import ConnectorArrowsPanel from './ConnectorArrowsPanel.vue';
import EffectsPanel from './EffectsPanel.vue';
import FillPanel from './FillPanel.vue';
import GroupInfoPanel from './GroupInfoPanel.vue';
import ImagePanel from './ImagePanel.vue';
import MediaPropertiesPanel from './MediaPropertiesPanel.vue';
import OlePropertiesPanel from './OlePropertiesPanel.vue';
import SmartArtPropertiesPanel from './SmartArtPropertiesPanel.vue';
import StrokePanel from './StrokePanel.vue';
import TableDataGrid from './TableDataGrid.vue';
import TablePanel from './TablePanel.vue';
import TextPanel from './TextPanel.vue';

/**
 * InspectorPane: the right-hand property inspector for the editor.
 *
 * Composes the per-concern property panels (arrange / fill / stroke / text /
 * effects) for the currently-selected element and relays each panel's `update`
 * patch upward. The host applies the patch via `useEditorOperations.updateElement`.
 *
 * Each panel follows the same contract: `props { element }`, `emits update(patch)`
 * where `patch` is a shallow `Partial<PptxElement>` (nested style objects are
 * emitted pre-merged by the panel).
 */
const props = defineProps<{
	element: PptxElement;
	mobile?: boolean;
	canEdit?: boolean;
	slideCount?: number;
	mediaDataUrls?: Map<string, string>;
	slideElements?: readonly PptxElement[];
	slideAnimations?: readonly PptxElementAnimation[];
	/** Read-only anchors for the deck's own effect groups; see {@link PptxAnimationTimelineAnchor}. */
	animationTimelineAnchors?: readonly PptxAnimationTimelineAnchor[];
}>();
const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
	updateSlideAnimations: [animations: PptxElementAnimation[]];
}>();

const { t } = useI18n();

const isShape = computed(() => hasShapeProperties(props.element));
const isText = computed(() => hasTextProperties(props.element));
const isImage = computed(() => isImageLikeElement(props.element));
const isTable = computed(() => props.element.type === 'table');
const isChart = computed(() => props.element.type === 'chart');
const isSmartArt = computed(() => props.element.type === 'smartArt');
const isMedia = computed(() => props.element.type === 'media');
// Arrowheads are a connector-only concern: `a:headEnd`/`a:tailEnd` are written
// on a `p:cxnSp`, so the card must not appear for any other element type.
const isConnector = computed(() => props.element.type === 'connector');
const isGroup = computed(() => props.element.type === 'group');
const isOle = computed(() => props.element.type === 'ole');

function relay(patch: Partial<PptxElement>): void {
	emit('update', patch);
}
</script>

<template>
	<aside
		:data-pptx-inspector="mobile ? undefined : ''"
		class="pptx-vue-inspector overflow-y-auto bg-background box-border px-3 pb-8 text-xs text-foreground"
		:class="mobile ? 'w-full pt-1' : 'w-72 flex-[0_0_18rem] border-l border-border pt-2'"
		:aria-label="t('pptx.inspector.properties')"
	>
		<div class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.arrange') }}
			</h3>
			<ArrangePanel :element="element" :can-edit="props.canEdit" @update="relay" />
		</div>

		<div v-if="isGroup" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.elementType.group') }}
			</h3>
			<GroupInfoPanel :element="element" />
		</div>

		<div v-if="isOle" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.ole.title') }}
			</h3>
			<OlePropertiesPanel :element="element" />
		</div>

		<div class="pptx-vue-inspector-section py-2 border-b border-border">
			<ActionSettingsPanel
				:element="element"
				:slide-count="props.slideCount"
				:can-edit="props.canEdit"
				@update="relay"
			/>
		</div>

		<div v-if="isText" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.text') }}
			</h3>
			<TextPanel :element="element" @update="relay" />
		</div>

		<div v-if="isImage" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.image') }}
			</h3>
			<ImagePanel :element="element" @update="relay" />
		</div>

		<div v-if="isTable" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.table') }}
			</h3>
			<TableDataGrid :element="element" :can-edit="props.canEdit" @update="relay" />
			<TablePanel :element="element" @update="relay" />
		</div>

		<div v-if="isChart" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.chart') }}
			</h3>
			<ChartPanel :element="element" @update="relay" />
		</div>

		<div v-if="isMedia" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.media') }}
			</h3>
			<MediaPropertiesPanel
				:element="element"
				:can-edit="props.canEdit"
				:media-data-urls="props.mediaDataUrls"
				@update="relay"
			/>
		</div>

		<div class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.animations') }}
			</h3>
			<AnimationPanel
				:element="element"
				:can-edit="props.canEdit"
				:slide-elements="props.slideElements"
				:slide-animations="props.slideAnimations"
				:animation-timeline-anchors="props.animationTimelineAnchors"
				@update="relay"
				@update-slide-animations="emit('updateSlideAnimations', $event)"
			/>
		</div>

		<div v-if="isSmartArt" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.smartArt') }}
			</h3>
			<SmartArtPropertiesPanel :element="element" @update="relay" />
		</div>

		<div v-if="isShape" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.fill') }}
			</h3>
			<FillPanel :element="element" @update="relay" />
		</div>

		<div v-if="isShape" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.line') }}
			</h3>
			<StrokePanel :element="element" @update="relay" />
		</div>

		<div v-if="isConnector" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.elementType.connector') }}
			</h3>
			<ConnectorArrowsPanel :element="element" :can-edit="props.canEdit" @update="relay" />
		</div>

		<div v-if="isShape" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.inspector.effects') }}
			</h3>
			<EffectsPanel :element="element" @update="relay" />
		</div>
	</aside>
</template>
