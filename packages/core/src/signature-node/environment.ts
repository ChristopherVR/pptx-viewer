/**
 * Environment-based configuration for digital signature validation.
 *
 * Node-only — reads trust roots from the file system and validation
 * policy from environment variables.
 */

import fs from 'node:fs/promises';

import {
	ENTERPRISE_FAIL_ON_REVOCATION_UNKNOWN_ENV,
	ENTERPRISE_REQUIRE_REVOCATION_ENV,
	ENTERPRISE_REQUIRE_TIMESTAMP_ENV,
	ENTERPRISE_TRUST_ROOTS_FILE_ENV,
	ENTERPRISE_TRUST_ROOTS_PEM_ENV,
} from '../core/utils/signature-constants';
import type { SignatureValidationPolicy } from '../core/utils/signature-types';
import { extractPemBlocks } from './pem-utils';

/** Extract individual PEM certificates from a text block. */
export function extractPemCertificatesFromText(text: string): string[] {
	return extractPemBlocks(text, 'CERTIFICATE')
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

function parseBooleanEnv(envValue: string | undefined): boolean {
	if (!envValue) {
		return false;
	}
	const normalized = envValue.trim().toLowerCase();
	return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseListEnv(envValue: string | undefined): string[] {
	if (!envValue) {
		return [];
	}
	return envValue
		.split(/[;,]/)
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

/**
 * Load enterprise trust root certificates from environment-configured sources.
 *
 * Checks `PPTX_VIEWER_TRUST_ROOTS_PEM` for inline PEM data and
 * `PPTX_VIEWER_TRUST_ROOTS_FILE` for file paths (semicolon/comma-separated).
 */
export async function loadEnterpriseTrustRoots(): Promise<string[]> {
	const roots: string[] = [];
	const inlinePem = process.env[ENTERPRISE_TRUST_ROOTS_PEM_ENV];
	if (inlinePem) {
		roots.push(...extractPemCertificatesFromText(inlinePem));
	}
	const trustRootPaths = parseListEnv(process.env[ENTERPRISE_TRUST_ROOTS_FILE_ENV]);
	for (const trustRootPath of trustRootPaths) {
		try {
			const pemText = await fs.readFile(trustRootPath, 'utf8');
			roots.push(...extractPemCertificatesFromText(pemText));
		} catch {
			// Ignore invalid enterprise trust root files. The report still includes trust errors.
		}
	}
	return roots;
}

/**
 * Read the signature validation policy from environment variables.
 */
export function getSignatureValidationPolicy(): SignatureValidationPolicy {
	return {
		requireRevocationCheck: parseBooleanEnv(process.env[ENTERPRISE_REQUIRE_REVOCATION_ENV]),
		failOnRevocationUnknown: parseBooleanEnv(
			process.env[ENTERPRISE_FAIL_ON_REVOCATION_UNKNOWN_ENV],
		),
		requireTimestamp: parseBooleanEnv(process.env[ENTERPRISE_REQUIRE_TIMESTAMP_ENV]),
	};
}
