<script setup lang="ts">
/**
 * ConnectorEndpointOverlay: the two handles PowerPoint puts on a selected
 * connector, which attach an end to a shape's connection point or detach it.
 *
 * Vue could DRAW a connector but never bind one: nothing in this binding ever
 * wrote `a:stCxn` / `a:endCxn`, so `connector-reroute` (a connector following
 * the shape it is anchored to) only ever fired for connectors that arrived
 * already bound from a `.pptx`.
 *
 * Rendered inside the scaled stage like every other canvas overlay, so all
 * coordinates are RAW SLIDE SPACE; the zoom is used only to convert pointer
 * screen positions back into it, and to keep the handles a constant screen size.
 *
 * Every decision is shared (`render/connector-endpoints`).
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	collectConnectorSiteCandidates,
	findConnectorSiteNear,
	getConnectorEndpointHandles,
	resolveConnectorEndpointUpdate,
	withConnectorEndpointUpdate,
} from 'pptx-viewer-shared';
import type { ConnectorEndpointKind } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	connector: PptxElement;
	elements: PptxElement[];
	/** `fitScale x userZoom`; used only to un-scale pointer travel. */
	zoom: number;
}>();

const emit = defineEmits<{
	commit: [payload: { id: string; element: PptxElement }];
}>();

const { t } = useI18n();
const rootEl = ref<HTMLElement | null>(null);
const drag = ref<{ kind: ConnectorEndpointKind; x: number; y: number } | null>(null);

const candidates = computed(() =>
	collectConnectorSiteCandidates(props.elements.filter((el) => el.id !== props.connector.id)),
);
const handles = computed(() => getConnectorEndpointHandles(props.connector));
const snap = computed(() =>
	drag.value ? findConnectorSiteNear(candidates.value, drag.value.x, drag.value.y) : null,
);
/** Handles keep a constant SCREEN size, like the resize handles beside them. */
const inverseZoom = computed(() => 1 / (props.zoom || 1));

function toSlidePoint(clientX: number, clientY: number): { x: number; y: number } {
	const rect = rootEl.value?.getBoundingClientRect();
	const scale = props.zoom || 1;
	return { x: (clientX - (rect?.left ?? 0)) / scale, y: (clientY - (rect?.top ?? 0)) / scale };
}

function onPointerMove(event: PointerEvent): void {
	if (!drag.value) {
		return;
	}
	drag.value = { ...drag.value, ...toSlidePoint(event.clientX, event.clientY) };
}

function onPointerUp(event: PointerEvent): void {
	const current = drag.value;
	detach();
	if (!current) {
		return;
	}
	const point = toSlidePoint(event.clientX, event.clientY);
	const target = findConnectorSiteNear(candidates.value, point.x, point.y);
	const update = resolveConnectorEndpointUpdate(
		props.connector,
		props.elements,
		current.kind,
		point,
		target,
	);
	emit('commit', {
		id: props.connector.id,
		element: withConnectorEndpointUpdate(props.connector, update),
	});
}

function detach(): void {
	drag.value = null;
	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('pointerup', onPointerUp);
	window.removeEventListener('pointercancel', onPointerUp);
}

function beginDrag(kind: ConnectorEndpointKind, event: PointerEvent): void {
	event.preventDefault();
	event.stopPropagation();
	drag.value = { kind, ...toSlidePoint(event.clientX, event.clientY) };
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerUp);
}

function handleStyle(handle: { kind: ConnectorEndpointKind; x: number; y: number }) {
	const live = drag.value?.kind === handle.kind ? drag.value : handle;
	return {
		left: `${live.x}px`,
		top: `${live.y}px`,
		transform: `translate(-50%, -50%) scale(${inverseZoom.value})`,
	};
}
</script>

<template>
	<div ref="rootEl" class="pptx-vue-connector-endpoints" data-pptx-connector-endpoints>
		<!-- Candidate connection points, revealed only while an end is in flight
		     so they never obscure the deck at rest. -->
		<div
			v-for="site in drag ? candidates : []"
			:key="`${site.elementId}-${site.siteIndex}`"
			class="pptx-vue-connection-site"
			:class="{
				'is-snapped': snap?.elementId === site.elementId && snap?.siteIndex === site.siteIndex,
			}"
			data-pptx-connection-site
			aria-hidden="true"
			:style="{
				left: `${site.x}px`,
				top: `${site.y}px`,
				transform: `translate(-50%, -50%) scale(${inverseZoom})`,
			}"
		/>

		<button
			v-for="handle in handles"
			:key="handle.kind"
			type="button"
			class="pptx-vue-connector-endpoint"
			:class="{ 'is-attached': handle.attached }"
			:data-pptx-connector-endpoint="handle.kind"
			:data-pptx-connector-attached="String(handle.attached)"
			:aria-label="
				t(
					handle.kind === 'start'
						? 'pptx.canvas.connectorEndpointStart'
						: 'pptx.canvas.connectorEndpointEnd',
				)
			"
			:style="handleStyle(handle)"
			@pointerdown="(e) => beginDrag(handle.kind, e)"
		/>
	</div>
</template>

<style scoped>
.pptx-vue-connector-endpoints {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 56;
}

.pptx-vue-connection-site {
	position: absolute;
	width: 8px;
	height: 8px;
	border-radius: 9999px;
	border: 2px solid #3b82f6;
	background: rgb(96 165 250 / 60%);
}

.pptx-vue-connection-site.is-snapped {
	background: #3b82f6;
}

/* A bound end is filled, a loose one hollow, so "is this connector actually
   attached?" is answerable at a glance. */
.pptx-vue-connector-endpoint {
	position: absolute;
	width: 10px;
	height: 10px;
	padding: 0;
	border-radius: 9999px;
	border: 2px solid #fff;
	background: #fff;
	box-shadow: 0 0 0 1px #16a34a;
	cursor: crosshair;
	pointer-events: auto;
	touch-action: none;
}

.pptx-vue-connector-endpoint.is-attached {
	background: #16a34a;
}
</style>
