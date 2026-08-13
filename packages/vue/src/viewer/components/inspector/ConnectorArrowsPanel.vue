<script setup lang="ts">
/**
 * ConnectorArrowsPanel: a connector's arrowheads, at parity with React's
 * `inspector/ConnectorArrowsSection.tsx`.
 *
 * WHY it exists: Vue shipped no arrowhead control anywhere in its inspector, so
 * selecting a connector gave a user Arrange / Text / Fill / Line / Effects and
 * no way to change either end's head. The six editable properties are
 * `a:ln/a:headEnd` and `a:ln/a:tailEnd`, each with a `type` plus a `w` (width)
 * and `len` (length) step, and Vue's renderer already honoured all six on
 * paint; only the editing surface was missing.
 *
 * The control list, option order, fallbacks and caption keys all come from
 * `pptx-viewer-shared`, so this SFC stays presentation: it renders descriptors
 * and relays a merged `shapeStyle` patch, exactly as the other panels do.
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { ConnectorArrowControl } from 'pptx-viewer-shared';
import {
	CONNECTOR_ARROW_CONTROLS,
	connectorArrowPatch,
	connectorArrowValue,
	schemaLabel,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(defineProps<{ element: PptxElement; canEdit?: boolean }>(), {
	canEdit: true,
});
const emit = defineEmits<{ update: [patch: Partial<PptxElement>] }>();

const { t } = useI18n();

const controls = CONNECTOR_ARROW_CONTROLS;

const shapeStyle = computed<ShapeStyle | undefined>(() =>
	hasShapeProperties(props.element) ? props.element.shapeStyle : undefined,
);

function valueOf(control: ConnectorArrowControl): string {
	return connectorArrowValue(control, shapeStyle.value);
}

/** Spell one option through the shared arrowhead / size vocabulary. */
function optionLabel(control: ConnectorArrowControl, value: string): string {
	return schemaLabel(control.optionLabelKeys, value, t);
}

/**
 * Emit the FULL merged `shapeStyle`, matching every other Vue panel: the host
 * forwards the patch verbatim to `ops.updateElement`, which records one undo
 * step and repaints the connector.
 */
function onChange(control: ConnectorArrowControl, event: Event): void {
	const patch = connectorArrowPatch(control, (event.target as HTMLSelectElement).value);
	emit('update', {
		shapeStyle: { ...shapeStyle.value, ...patch },
	} as Partial<PptxElement>);
}
</script>

<template>
	<div class="pptx-vue-connector-arrows grid grid-cols-2 gap-2">
		<label
			v-for="control in controls"
			:key="control.styleKey"
			class="pptx-vue-connector-arrow-field flex flex-col gap-1"
		>
			<span class="pptx-vue-connector-arrow-label text-muted-foreground">{{
				t(control.labelKey)
			}}</span>
			<select
				:aria-label="t(control.labelKey)"
				class="pptx-vue-connector-arrow-input w-full bg-muted border border-border rounded px-1.5 py-0.5"
				:value="valueOf(control)"
				:disabled="!props.canEdit"
				@change="onChange(control, $event)"
			>
				<option v-for="value in control.values" :key="value" :value="value">
					{{ optionLabel(control, value) }}
				</option>
			</select>
		</label>
	</div>
</template>
