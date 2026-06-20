<script setup lang="ts">
import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

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

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

const ole = computed<OlePptxElement | undefined>(() =>
	props.element.type === 'ole' ? props.element : undefined,
);

type ResolvedOleType = 'excel' | 'word' | 'pdf' | 'visio' | 'mathtype' | 'unknown';

/** Resolve the OLE application type from oleObjectType, falling back to progId. */
const oleType = computed<ResolvedOleType>(() => {
	const el = ole.value;
	if (!el) {
		return 'unknown';
	}
	if (el.oleObjectType && el.oleObjectType !== 'package' && el.oleObjectType !== 'unknown') {
		return el.oleObjectType;
	}
	const progId = el.oleProgId?.toLowerCase() ?? '';
	if (progId.includes('excel')) {
		return 'excel';
	}
	if (progId.includes('word')) {
		return 'word';
	}
	if (progId.includes('acroexch') || progId.includes('acrobat') || progId.includes('pdf')) {
		return 'pdf';
	}
	if (progId.includes('visio')) {
		return 'visio';
	}
	if (progId.includes('equation') || progId.includes('mathtype')) {
		return 'mathtype';
	}
	return 'unknown';
});

const TYPE_COLORS: Record<ResolvedOleType, string> = {
	excel: '#217346',
	word: '#2B579A',
	pdf: '#D4272E',
	visio: '#3955A3',
	mathtype: '#7B2D8E',
	unknown: '#666666',
};

const TYPE_LABELS: Record<ResolvedOleType, string> = {
	excel: 'Excel Spreadsheet',
	word: 'Word Document',
	pdf: 'PDF Document',
	visio: 'Visio Diagram',
	mathtype: 'Math Equation',
	unknown: 'Embedded Object',
};

const typeColor = computed(() => TYPE_COLORS[oleType.value]);
const typeLabel = computed(() => TYPE_LABELS[oleType.value]);

const previewSrc = computed<string | undefined>(() => ole.value?.previewImageData);
const fileName = computed<string | undefined>(() => ole.value?.fileName);
const displayName = computed(() => fileName.value ?? typeLabel.value);

const ariaLabel = computed(() =>
	fileName.value ? `${typeLabel.value}: ${fileName.value}` : typeLabel.value,
);

/** Short uppercase badge text for the preview overlay. */
const badgeLabel = computed(() =>
	oleType.value === 'unknown' ? 'OLE' : oleType.value.toUpperCase(),
);

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
		role="img"
		:aria-label="ariaLabel"
		title="Double-click to open"
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
</style>
