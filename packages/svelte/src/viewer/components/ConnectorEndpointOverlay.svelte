<script lang="ts">
	/**
	 * ConnectorEndpointOverlay: the two handles PowerPoint puts on a selected
	 * connector, which attach an end to a shape's connection point or detach it.
	 *
	 * Svelte could DRAW a connector but never bind one: nothing in this binding
	 * ever wrote `a:stCxn` / `a:endCxn`, so `connector-reroute` (a connector
	 * following the shape it is anchored to) only ever fired for connectors that
	 * arrived already bound from a `.pptx`.
	 *
	 * Like `SelectionOverlay`, this layer is UNSCALED: element geometry is
	 * multiplied by the stage scale when positioned, so the handles keep a
	 * constant on-screen size at any zoom. Every decision is shared
	 * (`render/connector-endpoints`); this component owns only the pointer
	 * lifecycle.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import {
		collectConnectorSiteCandidates,
		findConnectorSiteNear,
		getConnectorEndpointHandles,
	} from 'pptx-viewer-shared';
	import type { ConnectorEndpointKind } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		connector,
		elements,
		scale,
		drag = null,
		onendpointpointerdown,
	}: {
		connector: PptxElement;
		elements: PptxElement[];
		scale: number;
		/** Live drag position in SLIDE px, or null when idle. */
		drag?: { kind: ConnectorEndpointKind; x: number; y: number } | null;
		onendpointpointerdown: (kind: ConnectorEndpointKind, event: PointerEvent) => void;
	} = $props();

	const t = useTranslator();

	const handles = $derived(getConnectorEndpointHandles(connector));
	const candidates = $derived(
		drag ? collectConnectorSiteCandidates(elements.filter((el) => el.id !== connector.id)) : [],
	);
	const snapped = $derived(drag ? findConnectorSiteNear(candidates, drag.x, drag.y) : null);
</script>

<div class="pptx-svelte-connector-endpoints" data-pptx-connector-endpoints>
	<!-- Candidate connection points, revealed only while an end is in flight so
	     they never obscure the deck at rest. -->
	{#each candidates as site (`${site.elementId}-${site.siteIndex}`)}
		<div
			class="pptx-svelte-connection-site"
			class:is-snapped={snapped?.elementId === site.elementId &&
				snapped?.siteIndex === site.siteIndex}
			data-pptx-connection-site
			style={`left:${site.x * scale}px;top:${site.y * scale}px`}
		></div>
	{/each}

	{#each handles as handle (handle.kind)}
		<button
			type="button"
			class="pptx-svelte-connector-endpoint"
			class:is-attached={handle.attached}
			data-pptx-connector-endpoint={handle.kind}
			data-pptx-connector-attached={String(handle.attached)}
			data-pptx-compact
			aria-label={t(
				handle.kind === 'start'
					? 'pptx.canvas.connectorEndpointStart'
					: 'pptx.canvas.connectorEndpointEnd',
			)}
			style={`left:${(drag?.kind === handle.kind ? drag.x : handle.x) * scale}px;top:${(drag?.kind === handle.kind ? drag.y : handle.y) * scale}px`}
			onpointerdown={(event) => onendpointpointerdown(handle.kind, event)}
		></button>
	{/each}
</div>

<style>
	.pptx-svelte-connector-endpoints {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 6;
	}

	.pptx-svelte-connection-site {
		position: absolute;
		width: 8px;
		height: 8px;
		margin: -4px 0 0 -4px;
		border-radius: 9999px;
		border: 2px solid #3b82f6;
		background: rgba(96, 165, 250, 0.6);
	}

	.pptx-svelte-connection-site.is-snapped {
		background: #3b82f6;
	}

	/* A bound end is filled, a loose one hollow, so "is this connector actually
	   attached?" is answerable at a glance. */
	.pptx-svelte-connector-endpoint {
		position: absolute;
		width: 10px;
		height: 10px;
		margin: -5px 0 0 -5px;
		padding: 0;
		border-radius: 9999px;
		border: 2px solid #fff;
		background: #fff;
		box-shadow: 0 0 0 1px #16a34a;
		cursor: crosshair;
		pointer-events: auto;
		touch-action: none;
	}

	.pptx-svelte-connector-endpoint.is-attached {
		background: #16a34a;
	}
</style>
