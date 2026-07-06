import { validatePptx, repairPptx } from 'pptx-viewer-core';
import type { ValidationResult, RepairResult } from 'pptx-viewer-core';

// ── validatePresentation ─────────────────────────────────────────────────────

export interface ValidatePresentationResult {
	valid: boolean;
	issueCount: number;
	errors: number;
	warnings: number;
	issues: Array<{
		severity: string;
		code: string;
		message: string;
		path?: string;
	}>;
}

/**
 * Validate requires the raw bytes (ArrayBuffer) so this tool needs special
 * handling: the MCP server must pass rawBytes alongside the context.
 * We store a reference in ToolContext via resolveMedia or pass it directly.
 */
export async function validatePresentation(
	rawBytes: ArrayBuffer,
): Promise<ValidatePresentationResult> {
	const result: ValidationResult = await validatePptx(rawBytes);
	return {
		valid: result.valid,
		issueCount: result.issues.length,
		errors: result.issues.filter((i) => i.severity === 'error').length,
		warnings: result.issues.filter((i) => i.severity === 'warning').length,
		issues: result.issues,
	};
}

// ── repairPresentation ───────────────────────────────────────────────────────

export interface RepairPresentationResult {
	repairCount: number;
	repairs: string[];
}

export async function repairPresentation(
	rawBytes: ArrayBuffer,
): Promise<{ result: RepairPresentationResult; repairedBytes: ArrayBuffer }> {
	const result: RepairResult = await repairPptx(rawBytes);
	return {
		result: {
			repairCount: result.repairs.length,
			repairs: result.repairs,
		},
		repairedBytes: result.repaired,
	};
}
