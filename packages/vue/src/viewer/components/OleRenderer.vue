<script setup lang="ts">
import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
import {
	formatBytes,
	getOleBadgeLabel,
	getOleTypeColor,
	getOleTypeLabel,
	isBrowserOpenableMime,
	openUrlInNewTab,
	resolveOleType,
} from 'pptx-viewer-shared';
import type { ResolvedOleType } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { getContainerStyle } from '../composables/element-style';

/**
 * OleRenderer - Vue port of the React `renderOleElement`
 * (in `InkGroupRenderers.tsx`), viewer-first subset.
 *
 * Renders an embedded OLE object (`OlePptxElement`). When a decoded preview
 * image is present (`previewImageData`) it is shown with a small type badge
 * overlay; otherwise a type-specific icon + label placeholder box is drawn,
 * mirroring the React fallback.
 *
 * The OLE-type resolution (icon / colour / label) is replicated locally to
 * match the React renderer's branding. Double-click-to-open and extraction are
 * not ported (read-only viewer).
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
}>();

const { t } = useI18n();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

const ole = computed<OlePptxElement | undefined>(() =>
	props.element.type === 'ole' ? props.element : undefined,
);

/** Resolve the OLE application type from oleObjectType, falling back to progId. */
const oleType = computed<ResolvedOleType>(() => {
	const el = ole.value;
	return el ? resolveOleType(el) : 'unknown';
});

const typeColor = computed(() => getOleTypeColor(oleType.value));
const typeLabel = computed(() => getOleTypeLabel(oleType.value));

const previewSrc = computed<string | undefined>(() => ole.value?.previewImageData);
const fileName = computed<string | undefined>(() => ole.value?.fileName);

/** Recovered embedded payload data-URL, if core extracted one on load. */
const embeddedData = computed<string | undefined>(() => ole.value?.oleEmbeddedData);

/** Name to use for the download / info caption: embedded name wins, then the
 * OLE link file name, then a type-derived default. */
const downloadName = computed<string>(
	() => ole.value?.oleEmbeddedFileName ?? fileName.value ?? `${typeLabel.value}`,
);

const displayName = computed(
	() => ole.value?.oleEmbeddedFileName ?? fileName.value ?? typeLabel.value,
);

/** Human-readable size of the embedded payload, if known. */
const sizeLabel = computed<string | undefined>(() => formatBytes(ole.value?.oleEmbeddedByteSize));

/** The embedded MIME type, if known. */
const mimeType = computed<string | undefined>(() => ole.value?.oleEmbeddedMimeType);

/** Whether to offer an inline "Open" action (browser-renderable payload). */
const canOpenInBrowser = computed<boolean>(
	() => Boolean(embeddedData.value) && isBrowserOpenableMime(mimeType.value),
);

/** The application that produced the object (progId), if known. */
const application = computed<string | undefined>(() => ole.value?.oleProgId);

/** Multi-line info caption / accessible description: type, name, size, app. */
const infoLines = computed<string[]>(() => {
	const lines = [typeLabel.value];
	const name = ole.value?.oleEmbeddedFileName ?? fileName.value;
	if (name) {
		lines.push(name);
	}
	if (sizeLabel.value) {
		lines.push(sizeLabel.value);
	}
	if (application.value) {
		lines.push(application.value);
	}
	return lines;
});

const infoTitle = computed<string>(() => infoLines.value.join('\n'));

const ariaLabel = computed(() =>
	fileName.value ? `${typeLabel.value}: ${fileName.value}` : typeLabel.value,
);

/**
 * Open the embedded payload in a new browser tab. Used for browser-renderable
 * MIME types only. Routes through the shared {@link openUrlInNewTab} helper,
 * which converts the recovered `data:` URL to a Blob object URL first: browsers
 * silently refuse to navigate a new top-level tab straight to a `data:` URL.
 */
function openEmbedded(): void {
	const data = embeddedData.value;
	if (!data) {
		return;
	}
	openUrlInNewTab(data);
}

/** Swallow pointer/mouse interactions on the action bar so clicking an action
 * does not start a selection / drag in the editor. */
function stopInteraction(event: Event): void {
	event.stopPropagation();
}

/** Short uppercase badge text for the preview overlay. */
const badgeLabel = computed(() => getOleBadgeLabel(oleType.value));

const placeholderStyle = computed<CSSProperties>(() => ({
	border: `2px solid ${typeColor.value}33`,
	borderRadius: '6px',
	backgroundColor: `${typeColor.value}0d`,
}));
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-ole"
		:style="containerStyle"
		:data-element-id="element.id"
		role="group"
		:aria-label="ariaLabel"
		:title="infoTitle"
	>
		<!-- Preview image with type badge overlay -->
		<div v-if="previewSrc" class="pptx-vue-ole-preview">
			<img :src="previewSrc" :alt="ariaLabel" class="pptx-vue-ole-img" draggable="false" />
			<svg class="pptx-vue-ole-badge" width="24" height="24" viewBox="0 0 24 24">
				<rect x="2" y="2" width="20" height="20" rx="3" :fill="typeColor" />
				<text
					x="12"
					y="16"
					text-anchor="middle"
					fill="white"
					:font-size="badgeLabel.length > 4 ? 6 : 10"
					font-weight="bold"
				>
					{{ badgeLabel }}
				</text>
			</svg>
		</div>

		<!-- Type-specific placeholder box -->
		<div v-else class="pptx-vue-ole-placeholder" :style="placeholderStyle">
			<!-- Excel -->
			<svg v-if="oleType === 'excel'" width="36" height="36" viewBox="0 0 24 24" fill="none">
				<rect
					x="3"
					y="3"
					width="18"
					height="18"
					rx="2"
					:stroke="typeColor"
					stroke-width="1.5"
					fill="none"
				/>
				<line x1="3" y1="9" x2="21" y2="9" :stroke="typeColor" stroke-width="1" />
				<line x1="3" y1="15" x2="21" y2="15" :stroke="typeColor" stroke-width="1" />
				<line x1="9" y1="3" x2="9" y2="21" :stroke="typeColor" stroke-width="1" />
				<line x1="15" y1="3" x2="15" y2="21" :stroke="typeColor" stroke-width="1" />
			</svg>
			<!-- Word -->
			<svg v-else-if="oleType === 'word'" width="36" height="36" viewBox="0 0 24 24" fill="none">
				<rect
					x="4"
					y="2"
					width="16"
					height="20"
					rx="2"
					:stroke="typeColor"
					stroke-width="1.5"
					fill="none"
				/>
				<line
					x1="7"
					y1="7"
					x2="17"
					y2="7"
					:stroke="typeColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
				<line
					x1="7"
					y1="11"
					x2="17"
					y2="11"
					:stroke="typeColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
				<line
					x1="7"
					y1="15"
					x2="13"
					y2="15"
					:stroke="typeColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
			<!-- PDF -->
			<svg v-else-if="oleType === 'pdf'" width="36" height="36" viewBox="0 0 24 24" fill="none">
				<rect
					x="4"
					y="2"
					width="16"
					height="20"
					rx="2"
					:stroke="typeColor"
					stroke-width="1.5"
					fill="none"
				/>
				<text x="12" y="14" text-anchor="middle" :fill="typeColor" font-size="7" font-weight="bold">
					PDF
				</text>
			</svg>
			<!-- Visio -->
			<svg v-else-if="oleType === 'visio'" width="36" height="36" viewBox="0 0 24 24" fill="none">
				<rect
					x="8"
					y="2"
					width="8"
					height="5"
					rx="1"
					:stroke="typeColor"
					stroke-width="1.5"
					fill="none"
				/>
				<line x1="12" y1="7" x2="12" y2="10" :stroke="typeColor" stroke-width="1.5" />
				<line x1="6" y1="10" x2="18" y2="10" :stroke="typeColor" stroke-width="1.5" />
				<line x1="6" y1="10" x2="6" y2="13" :stroke="typeColor" stroke-width="1.5" />
				<line x1="18" y1="10" x2="18" y2="13" :stroke="typeColor" stroke-width="1.5" />
				<rect
					x="2"
					y="13"
					width="8"
					height="5"
					rx="1"
					:stroke="typeColor"
					stroke-width="1.5"
					fill="none"
				/>
				<rect
					x="14"
					y="13"
					width="8"
					height="5"
					rx="1"
					:stroke="typeColor"
					stroke-width="1.5"
					fill="none"
				/>
			</svg>
			<!-- MathType -->
			<svg
				v-else-if="oleType === 'mathtype'"
				width="36"
				height="36"
				viewBox="0 0 24 24"
				fill="none"
			>
				<rect
					x="2"
					y="4"
					width="20"
					height="16"
					rx="2"
					:stroke="typeColor"
					stroke-width="1.5"
					fill="none"
				/>
				<text
					x="12"
					y="15"
					text-anchor="middle"
					:fill="typeColor"
					font-size="9"
					font-style="italic"
					font-weight="bold"
				>
					f(x)
				</text>
			</svg>
			<!-- Generic -->
			<svg v-else width="36" height="36" viewBox="0 0 24 24" fill="none">
				<rect
					x="2"
					y="5"
					width="9"
					height="7"
					rx="1.5"
					:stroke="typeColor"
					stroke-width="1.5"
					fill="none"
				/>
				<rect
					x="13"
					y="12"
					width="9"
					height="7"
					rx="1.5"
					:stroke="typeColor"
					stroke-width="1.5"
					fill="none"
				/>
				<line
					x1="11"
					y1="8.5"
					x2="13"
					y2="15.5"
					:stroke="typeColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>

			<span class="pptx-vue-ole-name" :style="{ color: typeColor }">{{ displayName }}</span>
			<span v-if="fileName" class="pptx-vue-ole-sublabel">{{ typeLabel }}</span>
		</div>

		<!--
			Action bar: Download (and, for browser-openable types, Open) the
			recovered embedded payload, plus a compact info caption. Only shown
			when core extracted an embedded payload. pointer-events are enabled
			here (the visuals above are pointer-events:none) and interactions are
			stopped from bubbling so they do not start an editor selection/drag.
		-->
		<div
			v-if="embeddedData"
			class="pptx-vue-ole-actions"
			@pointerdown="stopInteraction"
			@mousedown="stopInteraction"
			@click="stopInteraction"
		>
			<span v-if="sizeLabel" class="pptx-vue-ole-meta">{{ sizeLabel }}</span>
			<a
				class="pptx-vue-ole-action"
				:href="embeddedData"
				:download="downloadName"
				:aria-label="t('pptx.ole.downloadName', { name: downloadName })"
				:title="t('pptx.ole.downloadName', { name: downloadName })"
			>
				{{ t('pptx.ole.download') }}
			</a>
			<button
				v-if="canOpenInBrowser"
				type="button"
				class="pptx-vue-ole-action"
				:aria-label="t('pptx.ole.openName', { name: downloadName })"
				:title="t('pptx.ole.openName', { name: downloadName })"
				@click="openEmbedded"
			>
				{{ t('pptx.ole.open') }}
			</button>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-ole-preview {
	position: relative;
	width: 100%;
	height: 100%;
}

.pptx-vue-ole-img {
	width: 100%;
	height: 100%;
	object-fit: contain;
	pointer-events: none;
	user-select: none;
	display: block;
}

.pptx-vue-ole-badge {
	position: absolute;
	bottom: 4px;
	right: 4px;
	z-index: 10;
	/* Decorative overlay: never intercept clicks meant for the action bar
	   (Download / Open), which shares the bottom-right corner. */
	pointer-events: none;
}

.pptx-vue-ole-placeholder {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	pointer-events: none;
	box-sizing: border-box;
}

.pptx-vue-ole-name {
	margin-top: 8px;
	font-size: 12px;
	font-weight: 500;
	max-width: 90%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pptx-vue-ole-sublabel {
	margin-top: 2px;
	font-size: 10px;
	color: rgba(0, 0, 0, 0.45);
	max-width: 90%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pptx-vue-ole-actions {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 6px;
	padding: 4px 6px;
	box-sizing: border-box;
	background: rgba(255, 255, 255, 0.82);
	border-top: 1px solid rgba(0, 0, 0, 0.08);
	font-size: 11px;
	/* Re-enable pointing on the action bar; the preview/icon above stay inert. */
	pointer-events: auto;
}

.pptx-vue-ole-meta {
	margin-right: auto;
	color: rgba(0, 0, 0, 0.55);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pptx-vue-ole-action {
	flex: none;
	padding: 2px 8px;
	border: 1px solid rgba(0, 0, 0, 0.18);
	border-radius: 4px;
	background: #fff;
	color: #1a1a1a;
	font: inherit;
	line-height: 1.4;
	cursor: pointer;
	text-decoration: none;
}

.pptx-vue-ole-action:hover {
	background: #f2f2f2;
}

.pptx-vue-ole-action:focus-visible {
	outline: 2px solid #2b6cb0;
	outline-offset: 1px;
}
</style>
