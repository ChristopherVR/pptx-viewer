<script setup lang="ts">
import { withBase } from 'vitepress';

import FeaturePanel from './FeaturePanel.vue';
import VisualCode from './visuals/VisualCode.vue';
import VisualEditor from './visuals/VisualEditor.vue';
import VisualFrameworks from './visuals/VisualFrameworks.vue';
import VisualMcp from './visuals/VisualMcp.vue';
</script>

<template>
	<FeaturePanel
		kicker="Rendering"
		title="Faithful to the deck, native to the DOM."
		:link-href="withBase('/guide/architecture')"
		link-text="How rendering works"
	>
		<p>
			187+ preset shapes, 23 chart types, SmartArt, animations, morph transitions, EMF and WMF
			metafiles, embedded fonts, and 3D models: all drawn with HTML, CSS, and SVG. No canvas
			rasterization, so text stays selectable and screen readers keep working.
		</p>
		<template #visual><VisualEditor /></template>
	</FeaturePanel>

	<FeaturePanel
		kicker="Data model"
		title="Load it, change it, save it back."
		:link-href="withBase('/core/loading')"
		link-text="Loading and parsing"
		flip
	>
		<p>
			A .pptx file goes in; a fully-typed PptxData model comes out. Sixteen element types, themes,
			masters, layouts, and OOXML Strict conformance survive the round trip, so an edited deck
			reopens cleanly in PowerPoint.
		</p>
		<template #visual><VisualCode /></template>
	</FeaturePanel>

	<FeaturePanel
		kicker="Frameworks"
		title="One engine. React, Vue, and Angular."
		:link-href="withBase('/guide/installation')"
		link-text="Choose a framework"
	>
		<p>
			The same viewer and WYSIWYG editor ships as a drop-in component for all three major
			frameworks. Each package bundles the core engine, so you install exactly one dependency and
			get feature parity everywhere: presenter mode, export, and real-time collaboration included.
		</p>
		<template #visual><VisualFrameworks /></template>
	</FeaturePanel>

	<FeaturePanel
		kicker="Automation"
		title="Built for agents as well as engineers."
		:link-href="withBase('/packages/mcp')"
		link-text="MCP and tools"
		flip
	>
		<p>
			pptx-viewer-mcp exposes 25 pure PPTX tools with Zod schemas as an MCP server, so Claude,
			Cursor, and Copilot can read, edit, and convert presentations directly. The same functions
			compose into your own pipelines, headless in Node, Bun, or serverless.
		</p>
		<template #visual><VisualMcp /></template>
	</FeaturePanel>
</template>
