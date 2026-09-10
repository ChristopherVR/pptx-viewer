<script setup lang="ts">
import type {
	ParsedTableStyleMap,
	PptxAnimationTimelineAnchor,
	PptxCustomShow,
	PptxElement,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties, isImageLikeElement } from 'pptx-viewer-core';
import { shouldShowAccessibilitySection } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AccessibilityPanel from './AccessibilityPanel.vue';
import ActionSettingsPanel from './ActionSettingsPanel.vue';
import AnimationPanel from './AnimationPanel.vue';
import ArrangePanel from './ArrangePanel.vue';
import ChartPanel from './ChartPanel.vue';
import ConnectorArrowsPanel from './ConnectorArrowsPanel.vue';
import EffectsPanel from './EffectsPanel.vue';
import FillPanel from './FillPanel.vue';
import GroupInfoPanel from './GroupInfoPanel.vue';
import ImagePanel from './ImagePanel.vue';
import InspectorSectionCard from './InspectorSectionCard.vue';
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
	/** Named custom shows, for the Action Settings "Custom show" target picker. */
	customShows?: readonly PptxCustomShow[];
	/**
	 * The deck's parsed `ppt/tableStyles.xml` map, needed by the table panel's
	 * "Edit style...". See `TableStyleOptions.vue`'s docblock for why this is
	 * optional.
	 */
	tableStyleMap?: ParsedTableStyleMap;
}>();
const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
	updateSlideAnimations: [animations: PptxElementAnimation[]];
	tableStyleMapChange: [nextMap: ParsedTableStyleMap];
	deleteTableStyle: [styleId: string];
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
// Accessibility (alt text / title): a picture's own field lives in
// `ImagePanel`; shared's `shouldShowAccessibilitySection` decides everything
// else, a plain shape, text box, connector, and every graphic-frame kind
// (table/chart/smartArt/media/ole), so this stays in sync with the other
// four bindings without a hard-coded type list here.
const showAccessibilitySection = computed(() => shouldShowAccessibilitySection(props.element));

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
		<InspectorSectionCard :title="t('pptx.inspector.arrange')">
			<ArrangePanel :element="element" :can-edit="props.canEdit" @update="relay" />
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isGroup" :title="t('pptx.elementType.group')">
			<GroupInfoPanel :element="element" />
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isOle" :title="t('pptx.ole.title')">
			<OlePropertiesPanel :element="element" :can-edit="props.canEdit" @update="relay" />
		</InspectorSectionCard>

		<InspectorSectionCard>
			<ActionSettingsPanel
				:element="element"
				:slide-count="props.slideCount"
				:can-edit="props.canEdit"
				:custom-shows="props.customShows"
				@update="relay"
			/>
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isText" :title="t('pptx.inspector.text')">
			<TextPanel :element="element" @update="relay" />
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isImage" :title="t('pptx.inspector.image')">
			<ImagePanel :element="element" @update="relay" />
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isTable" :title="t('pptx.inspector.table')">
			<TableDataGrid :element="element" :can-edit="props.canEdit" @update="relay" />
			<TablePanel
				:element="element"
				:table-style-map="props.tableStyleMap"
				@update="relay"
				@table-style-map-change="emit('tableStyleMapChange', $event)"
				@delete-table-style="emit('deleteTableStyle', $event)"
			/>
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isChart" :title="t('pptx.inspector.chart')">
			<ChartPanel :element="element" @update="relay" />
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isMedia" :title="t('pptx.inspector.media')">
			<MediaPropertiesPanel
				:element="element"
				:can-edit="props.canEdit"
				:media-data-urls="props.mediaDataUrls"
				@update="relay"
			/>
		</InspectorSectionCard>

		<InspectorSectionCard :title="t('pptx.inspector.animations')">
			<AnimationPanel
				:element="element"
				:can-edit="props.canEdit"
				:slide-elements="props.slideElements"
				:slide-animations="props.slideAnimations"
				:animation-timeline-anchors="props.animationTimelineAnchors"
				@update="relay"
				@update-slide-animations="emit('updateSlideAnimations', $event)"
			/>
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isSmartArt" :title="t('pptx.inspector.smartArt')">
			<SmartArtPropertiesPanel :element="element" @update="relay" />
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isShape" :title="t('pptx.inspector.fill')">
			<FillPanel :element="element" @update="relay" />
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isShape" :title="t('pptx.inspector.line')">
			<StrokePanel :element="element" @update="relay" />
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isConnector" :title="t('pptx.elementType.connector')">
			<ConnectorArrowsPanel :element="element" :can-edit="props.canEdit" @update="relay" />
		</InspectorSectionCard>

		<InspectorSectionCard v-if="isShape" :title="t('pptx.inspector.effects')">
			<EffectsPanel :element="element" @update="relay" />
		</InspectorSectionCard>

		<InspectorSectionCard v-if="showAccessibilitySection" :title="t('pptx.accessibility.heading')">
			<AccessibilityPanel :element="element" :can-edit="props.canEdit" @update="relay" />
		</InspectorSectionCard>
	</aside>
</template>

<style scoped>
/*
 * Touch target below MOBILE_BREAKPOINT (768, matches pptx-viewer-shared's
 * isDensePanelCompact/MIN_TOUCH_TARGET_PX): this inspector hosts dozens of
 * independently-styled sub-panel SFCs (FillPanel, ActionSettingsPanel,
 * ChartPanel option rows, ...), each sizing its own <select>/<button> for a
 * mouse. Rather than hand-patching every one (CLAUDE.md Rule 2: fix the
 * cross-cutting concern once), `:deep()` reaches through each child's own
 * scoping boundary from this shared host so every nested control clears the
 * WCAG target from a single place.
 *
 * `min-width` is NOT optional here even though a sub-panel might only set
 * its own `max-md:min-h-[...]`: `theme.css`'s baseline button rule
 * (`:where(.pptx-vue-viewer) :where(button, [role='button'])... { min-width:
 * 24px; min-height: 24px; }`) is UNLAYERED CSS, and an unlayered rule always
 * wins over a Tailwind utility class (which lives inside `@layer utilities`)
 * regardless of specificity, unless that utility carries `!`. A narrow
 * single-letter button (Bold "B", vertical-align "T"/"M"/"B", ...) that only
 * relies on a plain `max-md:min-w-[44px]` Tailwind class therefore silently
 * stays at the 24px baseline width even though its OWN min-height utility
 * (no competing unlayered rule) applies fine - this scoped rule's higher
 * specificity beats the `:where()` baseline on both axes at once, which is
 * why it must set both properties, not just the one sub-panels forget.
 */
@media (max-width: 767px) {
	.pptx-vue-inspector :deep(select),
	.pptx-vue-inspector :deep(button) {
		min-height: 44px;
		min-width: 44px;
	}
}
</style>
