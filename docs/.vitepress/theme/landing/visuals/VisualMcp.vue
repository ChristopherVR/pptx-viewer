<script setup lang="ts">
const tools = [
	'replaceText',
	'addSlide',
	'convertToMarkdown',
	'extractMedia',
	'applyTheme',
	'+ 20 more',
];
</script>

<template>
	<div class="pv-vmcp">
		<div class="pv-vmcp__config">
			<div class="pv-vmcp__bar">claude_desktop_config.json</div>
			<pre><code>{
  <span class="s">"mcpServers"</span>: {
    <span class="s">"pptx"</span>: {
      <span class="s">"command"</span>: <span class="s">"npx"</span>,
      <span class="s">"args"</span>: [<span class="s">"pptx-viewer-mcp"</span>]
    }
  }
}</code></pre>
		</div>
		<div class="pv-vmcp__tools">
			<span v-for="tool in tools" :key="tool" class="pv-vmcp__tool">{{ tool }}</span>
		</div>
	</div>
</template>

<style scoped>
.pv-vmcp__config {
	background: #14171b;
	border: 1px solid var(--pv-line);
	border-radius: 8px;
	overflow: hidden;
	box-shadow: var(--pv-shadow);
}

.dark .pv-vmcp__config {
	background: #101317;
	border-color: #272c33;
}

.pv-vmcp__bar {
	padding: 0.65rem 1.1rem;
	border-bottom: 1px solid rgba(240, 239, 236, 0.1);
	font-family: var(--pv-mono);
	font-size: 0.68rem;
	letter-spacing: 0.08em;
	color: rgba(240, 239, 236, 0.55);
}

.pv-vmcp pre {
	margin: 0;
	padding: 1.2rem 1.4rem;
	overflow-x: auto;
}

.pv-vmcp code {
	font-family: var(--pv-mono);
	font-size: 0.78rem;
	line-height: 1.7;
	color: #dfe3e8;
	background: none;
}

.pv-vmcp .s {
	color: #a8c795;
}

.pv-vmcp__tools {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	margin-top: 1rem;
}

.pv-vmcp__tool {
	font-family: var(--pv-mono);
	font-size: 0.66rem;
	letter-spacing: 0.06em;
	color: var(--pv-ink-soft);
	border: 1px solid var(--pv-line);
	border-radius: 99px;
	padding: 0.35em 0.9em;
	background: var(--pv-surface);
}

.pv-vmcp__tool:last-child {
	color: var(--pv-accent);
	border-color: var(--pv-accent);
}
</style>
