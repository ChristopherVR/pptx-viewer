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
</script>

<template>
	<!-- Open another presentation -->
	<template v-if="props.onOpenFile">
		<button :class="pill" title="Open another presentation" @click="props.onOpenFile()">
			<FolderOpen :class="ic" />
			Open
		</button>
		<div :class="SEP" />
	</template>

	<!-- Save & Export -->
	<button :class="pill" title="Save as Presentation (.pptx)" @click="props.onSaveAsPptx()">
		<Download :class="ic" />
		Save .pptx
	</button>
	<button :class="pill" title="Save as Slide Show (.ppsx)" @click="props.onSaveAsPpsx()">
		<Play :class="ic" />
		Save .ppsx
	</button>
	<button
		v-if="props.hasMacros"
		:class="pill"
		title="Save as Macro-Enabled (.pptm)"
		@click="props.onSaveAsPptm()"
	>
		<FileText :class="ic" />
		Save .pptm
	</button>
	<button :class="pill" title="Package for Sharing" @click="props.onPackageForSharing()">
		<Package :class="ic" />
		Package
	</button>

	<div :class="SEP" />

	<!-- Export -->
	<button :class="pill" title="Export as PNG" @click="props.onExportPng()">
		<Download :class="ic" />
		PNG
	</button>
	<button :class="pill" title="Export as PDF" @click="props.onExportPdf()">
		<FileText :class="ic" />
		PDF
	</button>
	<button :class="pill" title="Export as Video" @click="props.onExportVideo()">
		<Video :class="ic" />
		Video
	</button>
	<button :class="pill" title="Export as GIF" @click="props.onExportGif()">
		<Image :class="ic" />
		GIF
	</button>
	<button :class="pill" title="Copy Slide as Image" @click="props.onCopySlideAsImage()">
		<Copy :class="ic" />
		Copy Image
	</button>

	<div :class="SEP" />

	<!-- Print -->
	<button :class="pill" title="Print" @click="props.onPrint()">
		<Printer :class="ic" />
		Print
	</button>

	<div :class="SEP" />

	<!-- Info -->
	<button
		v-if="props.onOpenDocumentProperties"
		:class="pill"
		title="Document Properties"
		@click="props.onOpenDocumentProperties()"
	>
		<Info :class="ic" />
		Properties
	</button>
	<button
		v-if="props.onOpenPasswordProtection"
		:class="pill"
		title="Protect Presentation"
		@click="props.onOpenPasswordProtection()"
	>
		<Lock :class="ic" />
		Protect
	</button>
	<button
		v-if="props.onOpenFontEmbedding"
		:class="pill"
		title="Embed Fonts"
		@click="props.onOpenFontEmbedding()"
	>
		<Type :class="ic" />
		Fonts
	</button>
	<button
		v-if="props.onOpenDigitalSignatures"
		:class="pill"
		title="Digital Signatures"
		@click="props.onOpenDigitalSignatures()"
	>
		<ShieldAlert :class="ic" />
		Signatures
	</button>
</template>
