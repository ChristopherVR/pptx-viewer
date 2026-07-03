/**
 * signatures-panel.component.ts: Read-only digital-signature status panel.
 *
 * Selector: `pptx-signatures-panel`
 *
 * Lists each signature in the package (signer/certificate info, validity
 * status, signing timestamp) under an overall "Signed / Invalid / Not signed"
 * header. Purely presentational: it inspects, it never signs or strips.
 *
 * The host obtains the `signatures` array by parsing each `_xmlsignatures/`
 * part with the core `parseSignatureXml(...)` helper after a file loads.
 *
 * Angular port of the Vue `SignaturesPanel.vue`. All status derivation and
 * formatting is delegated to signatures-helpers.ts.
 *
 * Usage:
 * ```html
 * <pptx-signatures-panel [signatures]="parsedSignatures()" />
 * ```
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ParsedSignature } from 'pptx-viewer-core';

import {
	headerLabel,
	isSigned,
	overallStatus,
	signatureCountLabel,
	signatureKey,
	signatureTimestamp,
	signerName,
	statusKind,
	statusLabel,
} from './signatures-helpers';

@Component({
	selector: 'pptx-signatures-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section
			class="pptx-ng-signatures"
			[attr.aria-label]="'pptx.digitalSignatures.ariaLabel' | translate"
		>
			<header
				class="pptx-ng-signatures__header"
				[class]="'pptx-ng-signatures__header--' + overall()"
			>
				<span class="pptx-ng-signatures__dot" aria-hidden="true"></span>
				<span class="pptx-ng-signatures__title">{{ headerLabel() }}</span>
				@if (signed()) {
					<span class="pptx-ng-signatures__count">{{ countLabel() }}</span>
				}
			</header>

			@if (!signed()) {
				<p class="pptx-ng-signatures__empty">
					{{ 'pptx.digitalSignatures.noSignatures' | translate }}
				</p>
			} @else {
				<ul class="pptx-ng-signatures__list">
					@for (sig of signatures(); track key(sig, $index)) {
						<li class="pptx-ng-signatures__item" [class]="'pptx-ng-signatures__item--' + kind(sig)">
							<div class="pptx-ng-signatures__item-main">
								<span class="pptx-ng-signatures__signer">{{ signer(sig) }}</span>
								<span
									class="pptx-ng-signatures__badge"
									[class]="'pptx-ng-signatures__badge--' + kind(sig)"
								>
									{{ label(sig) }}
								</span>
							</div>

							<dl class="pptx-ng-signatures__meta">
								@if (sig.certificate?.issuer; as issuer) {
									<dt>{{ 'pptx.digitalSignatures.issuer' | translate }}</dt>
									<dd>{{ issuer }}</dd>
								}
								@if (sig.certificate?.serialNumber; as serial) {
									<dt>{{ 'pptx.digitalSignatures.serial' | translate }}</dt>
									<dd>{{ serial }}</dd>
								}
								@if (timestamp(sig); as ts) {
									<dt>{{ 'pptx.digitalSignatures.signed' | translate }}</dt>
									<dd>{{ ts }}</dd>
								}
								@if (!sig.certificate) {
									<dt>{{ 'pptx.digitalSignatures.certificate' | translate }}</dt>
									<dd>{{ 'pptx.digitalSignatures.notAvailable' | translate }}</dd>
								}
							</dl>
						</li>
					}
				</ul>
			}
		</section>
	`,
	styles: [
		`
			.pptx-ng-signatures {
				font-family: system-ui, sans-serif;
				font-size: 13px;
				color: #1f2937;
				background: #fff;
				border: 1px solid #e5e7eb;
				border-radius: 8px;
				overflow: hidden;
			}

			.pptx-ng-signatures__header {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 10px 12px;
				font-weight: 600;
				border-bottom: 1px solid #e5e7eb;
			}

			.pptx-ng-signatures__header--signed {
				background: #ecfdf5;
				color: #065f46;
			}

			.pptx-ng-signatures__header--invalid {
				background: #fef2f2;
				color: #991b1b;
			}

			.pptx-ng-signatures__header--unsigned {
				background: #f9fafb;
				color: #374151;
			}

			.pptx-ng-signatures__dot {
				width: 9px;
				height: 9px;
				border-radius: 50%;
				background: currentColor;
				flex: none;
			}

			.pptx-ng-signatures__title {
				flex: 1;
			}

			.pptx-ng-signatures__count {
				font-weight: 400;
				font-size: 12px;
				opacity: 0.8;
			}

			.pptx-ng-signatures__empty {
				margin: 0;
				padding: 14px 12px;
				color: #6b7280;
			}

			.pptx-ng-signatures__list {
				list-style: none;
				margin: 0;
				padding: 0;
			}

			.pptx-ng-signatures__item {
				padding: 10px 12px;
				border-bottom: 1px solid #f3f4f6;
				border-left: 3px solid transparent;
			}

			.pptx-ng-signatures__item:last-child {
				border-bottom: none;
			}

			.pptx-ng-signatures__item--valid {
				border-left-color: #10b981;
			}

			.pptx-ng-signatures__item--invalid {
				border-left-color: #ef4444;
			}

			.pptx-ng-signatures__item--unknown {
				border-left-color: #f59e0b;
			}

			.pptx-ng-signatures__item-main {
				display: flex;
				align-items: center;
				gap: 8px;
				justify-content: space-between;
			}

			.pptx-ng-signatures__signer {
				font-weight: 600;
				word-break: break-word;
			}

			.pptx-ng-signatures__badge {
				flex: none;
				font-size: 11px;
				font-weight: 600;
				padding: 2px 8px;
				border-radius: 999px;
				white-space: nowrap;
			}

			.pptx-ng-signatures__badge--valid {
				background: #d1fae5;
				color: #065f46;
			}

			.pptx-ng-signatures__badge--invalid {
				background: #fee2e2;
				color: #991b1b;
			}

			.pptx-ng-signatures__badge--unknown {
				background: #fef3c7;
				color: #92400e;
			}

			.pptx-ng-signatures__meta {
				display: grid;
				grid-template-columns: auto 1fr;
				gap: 2px 10px;
				margin: 6px 0 0;
				font-size: 12px;
				color: #4b5563;
			}

			.pptx-ng-signatures__meta dt {
				font-weight: 500;
				color: #6b7280;
			}

			.pptx-ng-signatures__meta dd {
				margin: 0;
				word-break: break-word;
			}
		`,
	],
})
export class SignaturesPanelComponent {
	// -------------------------------------------------------------------------
	// Inputs
	// -------------------------------------------------------------------------

	/** Parsed signatures to inspect (host parses and supplies them). */
	readonly signatures = input<ParsedSignature[]>([]);

	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	/** True when the package carries at least one signature part. */
	readonly signed = computed<boolean>(() => isSigned(this.signatures()));

	/** Coarse-grained "Signed / Invalid / Not signed" classification. */
	readonly overall = computed(() => overallStatus(this.signatures()));

	/** Header label for the panel. */
	readonly headerLabel = computed<string>(() => headerLabel(this.overall()));

	/** "N signature(s)" count label. */
	readonly countLabel = computed<string>(() => signatureCountLabel(this.signatures().length));

	// -------------------------------------------------------------------------
	// Template helpers (delegate to pure functions)
	// -------------------------------------------------------------------------

	key(sig: ParsedSignature, index: number): string {
		return signatureKey(sig, index);
	}

	kind(sig: ParsedSignature): string {
		return statusKind(sig.status);
	}

	label(sig: ParsedSignature): string {
		return statusLabel(sig.status);
	}

	signer(sig: ParsedSignature): string {
		return signerName(sig);
	}

	timestamp(sig: ParsedSignature): string | undefined {
		return signatureTimestamp(sig);
	}
}
