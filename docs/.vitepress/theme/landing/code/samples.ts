/**
 * Framework metadata + code samples for the landing page. None of this is
 * localized: package names, install commands, and code are identical in
 * every locale. Samples mirror the per-framework getting-started guides;
 * keep them in sync with those pages.
 */

export interface FrameworkSample {
	id: string;
	label: string;
	install: string;
	file: string;
	docsHref: string;
	code: string;
}

export const FRAMEWORKS: FrameworkSample[] = [
	{
		id: 'react',
		label: 'React',
		install: 'npm i pptx-react-viewer',
		file: 'Deck.tsx',
		docsHref: '/react/getting-started',
		code: `import { PowerPointViewer } from 'pptx-react-viewer';
import { useEffect, useState } from 'react';
import 'pptx-react-viewer/styles';

export function Deck() {
  const [content, setContent] = useState<Uint8Array | null>(null);

  useEffect(() => {
    fetch('/deck.pptx')
      .then((r) => r.arrayBuffer())
      .then((buf) => setContent(new Uint8Array(buf)));
  }, []);

  if (!content) return <div>Loading...</div>;
  return (
    <div style={{ height: '100vh' }}>
      <PowerPointViewer content={content} canEdit />
    </div>
  );
}`,
	},
	{
		id: 'vue',
		label: 'Vue 3',
		install: 'npm i pptx-vue-viewer',
		file: 'Deck.vue',
		docsHref: '/vue/getting-started',
		code: `<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import { onMounted, ref } from 'vue';
import 'pptx-vue-viewer/styles';

const content = ref<Uint8Array | null>(null);

onMounted(async () => {
  const buf = await fetch('/deck.pptx').then((r) => r.arrayBuffer());
  content.value = new Uint8Array(buf);
});
</script>

<template>
  <div style="height: 100vh">
    <PowerPointViewer v-if="content" :content="content" can-edit />
  </div>
</template>`,
	},
	{
		id: 'angular',
		label: 'Angular',
		install: 'npm i pptx-angular-viewer',
		file: 'deck.component.ts',
		docsHref: '/angular/getting-started',
		code: `import { Component, signal } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';
import 'pptx-angular-viewer/styles';

@Component({
  selector: 'app-deck',
  standalone: true,
  imports: [PowerPointViewerComponent],
  template: \`
    <div style="height: 100vh">
      @if (content(); as bytes) {
        <pptx-viewer [content]="bytes" [canEdit]="true" />
      }
    </div>
  \`,
})
export class DeckComponent {
  readonly content = signal<ArrayBuffer | null>(null);

  constructor() {
    fetch('/deck.pptx')
      .then((r) => r.arrayBuffer())
      .then((buf) => this.content.set(buf));
  }
}`,
	},
	{
		id: 'svelte',
		label: 'Svelte 5',
		install: 'npm i pptx-svelte-viewer',
		file: 'Deck.svelte',
		docsHref: '/svelte/getting-started',
		code: `<script lang="ts">
  import { PowerPointViewer } from 'pptx-svelte-viewer';

  let bytes = $state<Uint8Array | null>(null);

  fetch('/deck.pptx')
    .then((r) => r.arrayBuffer())
    .then((buf) => (bytes = new Uint8Array(buf)));
</script>

{#if bytes}
  <div style="height: 100dvh">
    <PowerPointViewer source={bytes} />
  </div>
{/if}`,
	},
	{
		id: 'vanilla',
		label: 'Vanilla JS',
		install: 'npm i pptx-vanilla-viewer',
		file: 'main.ts',
		docsHref: '/vanilla/getting-started',
		code: `import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
  source: '/deck.pptx',
  onLoad: ({ slideCount }) => console.log(slideCount, 'slides'),
  onError: (message) => console.error(message),
});

// Everything the toolbar does is on the instance too
viewer.goToSlide(3);
viewer.setZoom('fit');
await viewer.enterPresentation();`,
	},
];

export const MCP_CONFIG_SAMPLE = `{
  "mcpServers": {
    "pptx": {
      "command": "npx",
      "args": ["pptx-viewer-mcp"]
    }
  }
}`;

export const HEADLESS_SAMPLE = `import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const deck = await handler.load(bytes);

// Every element is a typed, discriminated union
for (const el of deck.slides[0].elements) {
  if (el.type === 'text') el.text = rebrand(el.text);
}

// Serialize straight back to a valid .pptx
const file = await handler.save(deck.slides);`;
