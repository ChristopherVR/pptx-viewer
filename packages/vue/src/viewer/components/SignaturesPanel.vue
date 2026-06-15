<script setup lang="ts">
import type { ParsedSignature, SignatureStatus } from 'pptx-viewer-core';
import { computed } from 'vue';

import { useSignatures } from '../composables/useSignatures';

/**
 * SignaturesPanel — read-only digital-signature status panel.
 *
 * Lists each signature in the package (signer/certificate info, validity
 * status, signing timestamp) under an overall "Signed / Invalid / Not signed"
 * header. Purely presentational: it inspects, it never signs or strips.
 *
 * The host obtains the `signatures` array by parsing each `_xmlsignatures/`
 * part with the core `parseSignatureXml(...)` helper after a file loads.
 */
const props = defineProps<{
	signatures: ParsedSignature[];
}>();

const { isSigned, status, overall } = useSignatures(() => props.signatures);

const headerLabel = computed<string>(() => {
	switch (overall.value) {
		case 'invalid':
			return 'Invalid signature';
		case 'signed':
			return 'Signed';
		default:
			return 'Not signed';
	}
});

/** Human-readable label for a per-signature status. */
function statusLabel(s: SignatureStatus): string {
	switch (s) {
		case 'valid':
			return 'Valid';
		case 'invalid':
			return 'Invalid';
		case 'expired':
			return 'Expired';
		case 'unknownCA':
			return 'Unknown certificate authority';
		default:
			return 'Unverified';
	}
}

/** Coarse validity bucket for styling: valid / invalid / unknown. */
function statusKind(s: SignatureStatus): 'valid' | 'invalid' | 'unknown' {
	if (s === 'valid') {
		return 'valid';
	}
	if (s === 'invalid' || s === 'expired') {
		return 'invalid';
	}
	return 'unknown';
}

/** Best-effort signer name: certificate subject, else issuer, else path. */
function signerName(sig: ParsedSignature): string {
	return sig.certificate?.subject ?? sig.certificate?.issuer ?? sig.signaturePath;
}

/**
 * Best-effort signing timestamp. The parsed signature does not carry a
 * dedicated signing-time field in the public shape, so we fall back to the
 * certificate's validity window when present.
 */
function timestamp(sig: ParsedSignature): string | undefined {
	const raw = sig.certificate?.validFrom;
	if (!raw) {
		return undefined;
	}
	const d = new Date(raw);
	return Number.isNaN(d.getTime()) ? raw : d.toLocaleString();
}

function signatureKey(sig: ParsedSignature, index: number): string {
	return `${sig.signaturePath}-${index}`;
}
</script>

<template>
	<section class="pptx-vue-signatures" aria-label="Digital signatures">
		<header class="pptx-vue-signatures__header" :class="`pptx-vue-signatures__header--${overall}`">
			<span class="pptx-vue-signatures__dot" aria-hidden="true" />
			<span class="pptx-vue-signatures__title">{{ headerLabel }}</span>
			<span v-if="isSigned" class="pptx-vue-signatures__count">
				{{ props.signatures.length }}
				signature{{ props.signatures.length === 1 ? '' : 's' }}
			</span>
		</header>

		<p v-if="!isSigned" class="pptx-vue-signatures__empty">
			This presentation has no digital signatures.
		</p>

		<ul v-else class="pptx-vue-signatures__list">
			<li
				v-for="(sig, index) in props.signatures"
				:key="signatureKey(sig, index)"
				class="pptx-vue-signatures__item"
				:class="`pptx-vue-signatures__item--${statusKind(sig.status)}`"
			>
				<div class="pptx-vue-signatures__item-main">
					<span class="pptx-vue-signatures__signer">{{ signerName(sig) }}</span>
					<span
						class="pptx-vue-signatures__badge"
						:class="`pptx-vue-signatures__badge--${statusKind(sig.status)}`"
					>
						{{ statusLabel(sig.status) }}
					</span>
				</div>

				<dl class="pptx-vue-signatures__meta">
					<template v-if="sig.certificate?.issuer">
						<dt>Issuer</dt>
						<dd>{{ sig.certificate.issuer }}</dd>
					</template>
					<template v-if="sig.certificate?.serialNumber">
						<dt>Serial</dt>
						<dd>{{ sig.certificate.serialNumber }}</dd>
					</template>
					<template v-if="timestamp(sig)">
						<dt>Signed</dt>
						<dd>{{ timestamp(sig) }}</dd>
					</template>
					<template v-if="!sig.certificate">
						<dt>Certificate</dt>
						<dd>Not available</dd>
					</template>
				</dl>
			</li>
		</ul>
	</section>
</template>

<style scoped>
.pptx-vue-signatures {
	font-family: system-ui, sans-serif;
	font-size: 13px;
	color: #1f2937;
	background: #fff;
	border: 1px solid #e5e7eb;
	border-radius: 8px;
	overflow: hidden;
}

.pptx-vue-signatures__header {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 12px;
	font-weight: 600;
	border-bottom: 1px solid #e5e7eb;
}

.pptx-vue-signatures__header--signed {
	background: #ecfdf5;
	color: #065f46;
}

.pptx-vue-signatures__header--invalid {
	background: #fef2f2;
	color: #991b1b;
}

.pptx-vue-signatures__header--unsigned {
	background: #f9fafb;
	color: #374151;
}

.pptx-vue-signatures__dot {
	width: 9px;
	height: 9px;
	border-radius: 50%;
	background: currentColor;
	flex: none;
}

.pptx-vue-signatures__title {
	flex: 1;
}

.pptx-vue-signatures__count {
	font-weight: 400;
	font-size: 12px;
	opacity: 0.8;
}

.pptx-vue-signatures__empty {
	margin: 0;
	padding: 14px 12px;
	color: #6b7280;
}

.pptx-vue-signatures__list {
	list-style: none;
	margin: 0;
	padding: 0;
}

.pptx-vue-signatures__item {
	padding: 10px 12px;
	border-bottom: 1px solid #f3f4f6;
	border-left: 3px solid transparent;
}

.pptx-vue-signatures__item:last-child {
	border-bottom: none;
}

.pptx-vue-signatures__item--valid {
	border-left-color: #10b981;
}

.pptx-vue-signatures__item--invalid {
	border-left-color: #ef4444;
}

.pptx-vue-signatures__item--unknown {
	border-left-color: #f59e0b;
}

.pptx-vue-signatures__item-main {
	display: flex;
	align-items: center;
	gap: 8px;
	justify-content: space-between;
}

.pptx-vue-signatures__signer {
	font-weight: 600;
	word-break: break-word;
}

.pptx-vue-signatures__badge {
	flex: none;
	font-size: 11px;
	font-weight: 600;
	padding: 2px 8px;
	border-radius: 999px;
	white-space: nowrap;
}

.pptx-vue-signatures__badge--valid {
	background: #d1fae5;
	color: #065f46;
}

.pptx-vue-signatures__badge--invalid {
	background: #fee2e2;
	color: #991b1b;
}

.pptx-vue-signatures__badge--unknown {
	background: #fef3c7;
	color: #92400e;
}

.pptx-vue-signatures__meta {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: 2px 10px;
	margin: 6px 0 0;
	font-size: 12px;
	color: #4b5563;
}

.pptx-vue-signatures__meta dt {
	font-weight: 500;
	color: #6b7280;
}

.pptx-vue-signatures__meta dd {
	margin: 0;
	word-break: break-word;
}
</style>
