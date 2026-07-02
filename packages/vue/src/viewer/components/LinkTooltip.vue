<script setup lang="ts">
/**
 * LinkTooltip: PowerPoint-style hover tooltip for actionable elements and
 * hyperlinks. Vue port of the React `elements/LinkTooltip.tsx`.
 *
 * Shows the link destination (or tooltip text) plus a follow hint. Uses CSS
 * group-hover for zero-state display: the parent element must carry the
 * `group/link` class.
 */
defineProps<{
	/** The link URL or tooltip text to display. */
	label: string;
	/** Whether this action is an external URL (vs. a slide-navigation action). */
	hasUrl?: boolean;
}>();
</script>

<template>
	<div
		class="pointer-events-none absolute left-1 top-full z-[9999] mt-1 max-w-64 opacity-0 transition-opacity duration-150 group-hover/link:opacity-100"
	>
		<div class="rounded border border-border bg-popover px-2.5 py-1.5 shadow-lg">
			<div class="truncate text-xs text-foreground">{{ label }}</div>
			<div class="mt-0.5 text-[10px] text-muted-foreground">
				{{ hasUrl ? 'Ctrl+Click to follow link' : 'Active in presentation mode' }}
			</div>
		</div>
	</div>
</template>
