<script setup lang="ts">
/**
 * FileSection: the Vue 3 port of React's `toolbar/FileSection.tsx`. Renders the
 * File ribbon tab's Save/Export/Print/Info pill buttons. A faithful, mechanical
 * port for visual + behavioral parity: class strings are copied verbatim, the
 * `react-icons/lu` glyphs become their `lucide-vue-next` equivalents, and React's
 * individual callback props become Vue `defineProps` callbacks invoked directly.
 */
import {
	Copy,
	Download,
	FileText,
	FolderOpen,
	Image,
	Info,
	Lock,
	Package,
	Play,
	Printer,
	ShieldAlert,
	Type,
	Video,
} from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { ic, pill, SEP } from './ribbon-constants';

interface Props {
	/** Open another presentation. Hidden when not provided. */
	onOpenFile?: () => void;
	onExportPng: () => void;
	onExportPdf: () => void;
	onExportVideo: () => void;
	onExportGif: () => void;
	onPackageForSharing: () => void;
	onSaveAsPptx: () => void;
	onSaveAsPpsx: () => void;
	onSaveAsPptm: () => void;
	hasMacros: boolean;
	onCopySlideAsImage: () => void;
	onPrint: () => void;
	onOpenDocumentProperties?: () => void;
	onOpenPasswordProtection?: () => void;
	onOpenFontEmbedding?: () => void;
	onOpenDigitalSignatures?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();
</script>

<template>
	<!-- Open another presentation -->
	<template v-if="props.onOpenFile">
		<button :class="pill" :title="t('pptx.file.openTooltip')" @click="props.onOpenFile()">
			<FolderOpen :class="ic" />
			{{ t('pptx.file.open') }}
		</button>
		<div :class="SEP" />
	</template>

	<!-- Save & Export -->
	<button :class="pill" :title="t('pptx.file.saveAsPptxTooltip')" @click="props.onSaveAsPptx()">
		<Download :class="ic" />
		{{ t('pptx.file.saveAsPptx') }}
	</button>
	<button :class="pill" :title="t('pptx.file.saveAsPpsxTooltip')" @click="props.onSaveAsPpsx()">
		<Play :class="ic" />
		{{ t('pptx.file.saveAsPpsx') }}
	</button>
	<button
		v-if="props.hasMacros"
		:class="pill"
		:title="t('pptx.file.saveAsPptmTooltip')"
		@click="props.onSaveAsPptm()"
	>
		<FileText :class="ic" />
		{{ t('pptx.file.saveAsPptm') }}
	</button>
	<button :class="pill" :title="t('pptx.file.packageTooltip')" @click="props.onPackageForSharing()">
		<Package :class="ic" />
		{{ t('pptx.file.package') }}
	</button>

	<div :class="SEP" />

	<!-- Export -->
	<button :class="pill" :title="t('pptx.file.exportPngTooltip')" @click="props.onExportPng()">
		<Download :class="ic" />
		{{ t('pptx.file.png') }}
	</button>
	<button :class="pill" :title="t('pptx.file.exportPdfTooltip')" @click="props.onExportPdf()">
		<FileText :class="ic" />
		{{ t('pptx.file.pdf') }}
	</button>
	<button :class="pill" :title="t('pptx.file.exportVideoTooltip')" @click="props.onExportVideo()">
		<Video :class="ic" />
		{{ t('pptx.file.video') }}
	</button>
	<button :class="pill" :title="t('pptx.file.exportGifTooltip')" @click="props.onExportGif()">
		<Image :class="ic" />
		{{ t('pptx.file.gif') }}
	</button>
	<button
		:class="pill"
		:title="t('pptx.file.copyImageTooltip')"
		@click="props.onCopySlideAsImage()"
	>
		<Copy :class="ic" />
		{{ t('pptx.file.copyImage') }}
	</button>

	<div :class="SEP" />

	<!-- Print -->
	<button :class="pill" :title="t('pptx.print.printButton')" @click="props.onPrint()">
		<Printer :class="ic" />
		{{ t('pptx.print.printButton') }}
	</button>

	<div :class="SEP" />

	<!-- Info -->
	<button
		v-if="props.onOpenDocumentProperties"
		:class="pill"
		:title="t('pptx.file.documentPropertiesTooltip')"
		@click="props.onOpenDocumentProperties()"
	>
		<Info :class="ic" />
		{{ t('pptx.file.properties') }}
	</button>
	<button
		v-if="props.onOpenPasswordProtection"
		:class="pill"
		:title="t('pptx.file.protectTooltip')"
		@click="props.onOpenPasswordProtection()"
	>
		<Lock :class="ic" />
		{{ t('pptx.file.protect') }}
	</button>
	<button
		v-if="props.onOpenFontEmbedding"
		:class="pill"
		:title="t('pptx.file.embedFontsTooltip')"
		@click="props.onOpenFontEmbedding()"
	>
		<Type :class="ic" />
		{{ t('pptx.file.fonts') }}
	</button>
	<button
		v-if="props.onOpenDigitalSignatures"
		:class="pill"
		:title="t('pptx.file.digitalSignaturesTooltip')"
		@click="props.onOpenDigitalSignatures()"
	>
		<ShieldAlert :class="ic" />
		{{ t('pptx.file.signatures') }}
	</button>
</template>
