<script setup lang="ts">
import type { ParsedSignature, SignatureStatus } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSignatures } from '../composables/useSignatures';

const { t } = useI18n();

/**
 * SignaturesPanel - read-only digital-signature status panel.
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
			return t('pptx.digitalSignatures.invalidHeader');
		case 'signed':
			return t('pptx.digitalSignatures.headerSigned');
		default:
			return t('pptx.digitalSignatures.notSigned');
	}
});

/** Human-readable label for a per-signature status. */
function statusLabel(s: SignatureStatus): string {
	switch (s) {
		case 'valid':
			return t('pptx.digitalSignatures.statusValid');
		case 'invalid':
			return t('pptx.digitalSignatures.statusInvalid');
		case 'expired':
			return t('pptx.digitalSignatures.statusExpired');
		case 'unknownCA':
			return t('pptx.digitalSignatures.statusUnknownCA');
		default:
			return t('pptx.digitalSignatures.statusUnverified');
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
	<section
		class="pptx-vue-signatures overflow-hidden rounded-lg border border-border bg-popover text-[13px] text-foreground"
		:aria-label="t('pptx.digitalSignatures.ariaLabel')"
	>
		<header
			class="pptx-vue-signatures__header flex items-center gap-2 border-b border-border px-3 py-2.5 font-semibold"
			:class="[
				`pptx-vue-signatures__header--${overall}`,
				{
					'bg-green-900/20 text-green-300': overall === 'signed',
					'bg-red-900/20 text-red-300': overall === 'invalid',
					'bg-muted/30 text-foreground': overall === 'unsigned',
				},
			]"
		>
			<span
				class="pptx-vue-signatures__dot h-2.5 w-2.5 flex-none rounded-full bg-current"
				aria-hidden="true"
			/>
			<span class="pptx-vue-signatures__title flex-1">{{ headerLabel }}</span>
			<span v-if="isSigned" class="pptx-vue-signatures__count text-xs font-normal opacity-80">
				{{ t('pptx.digitalSignatures.signatureCount', { count: props.signatures.length }) }}
			</span>
		</header>

		<p v-if="!isSigned" class="pptx-vue-signatures__empty m-0 px-3 py-3.5 text-muted-foreground">
			{{ t('pptx.digitalSignatures.noSignatures') }}
		</p>

		<ul v-else class="pptx-vue-signatures__list m-0 list-none p-0">
			<li
				v-for="(sig, index) in props.signatures"
				:key="signatureKey(sig, index)"
				class="pptx-vue-signatures__item border-b border-l-[3px] border-b-border/60 border-l-transparent px-3 py-2.5 last:border-b-0"
				:class="[
					`pptx-vue-signatures__item--${statusKind(sig.status)}`,
					{
						'border-l-green-500': statusKind(sig.status) === 'valid',
						'border-l-red-500': statusKind(sig.status) === 'invalid',
						'border-l-amber-500': statusKind(sig.status) === 'unknown',
					},
				]"
			>
				<div class="pptx-vue-signatures__item-main flex items-center justify-between gap-2">
					<span class="pptx-vue-signatures__signer font-semibold break-words">{{
						signerName(sig)
					}}</span>
					<span
						class="pptx-vue-signatures__badge flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
						:class="[
							`pptx-vue-signatures__badge--${statusKind(sig.status)}`,
							{
								'bg-green-900/30 text-green-300': statusKind(sig.status) === 'valid',
								'bg-red-900/30 text-red-300': statusKind(sig.status) === 'invalid',
								'bg-amber-900/30 text-amber-300': statusKind(sig.status) === 'unknown',
							},
						]"
					>
						{{ statusLabel(sig.status) }}
					</span>
				</div>

				<dl
					class="pptx-vue-signatures__meta m-0 mt-1.5 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground [&_dd]:m-0 [&_dd]:break-words [&_dt]:font-medium [&_dt]:text-muted-foreground"
				>
					<template v-if="sig.certificate?.issuer">
						<dt>{{ t('pptx.digitalSignatures.issuer') }}</dt>
						<dd>{{ sig.certificate.issuer }}</dd>
					</template>
					<template v-if="sig.certificate?.serialNumber">
						<dt>{{ t('pptx.digitalSignatures.serial') }}</dt>
						<dd>{{ sig.certificate.serialNumber }}</dd>
					</template>
					<template v-if="timestamp(sig)">
						<dt>{{ t('pptx.digitalSignatures.headerSigned') }}</dt>
						<dd>{{ timestamp(sig) }}</dd>
					</template>
					<template v-if="!sig.certificate">
						<dt>{{ t('pptx.digitalSignatures.certificate') }}</dt>
						<dd>{{ t('pptx.digitalSignatures.notAvailable') }}</dd>
					</template>
				</dl>
			</li>
		</ul>
	</section>
</template>
