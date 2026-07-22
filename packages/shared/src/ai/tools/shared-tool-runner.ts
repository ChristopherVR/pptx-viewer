/**
 * The seam that lets the in-viewer AI assistant run the SAME tool logic the
 * `pptx-viewer-mcp` server exposes, against the LIVE open deck instead of a file
 * on disk.
 *
 * Each MCP tool is a pure(ish) `PptxData` transform: `fn(ctx, params) ->
 * { pptxData, result, dirty }`. Here we assemble a working {@link PptxData} from
 * the bridge's live slides + theme (overlaid on the binding's full parsed data
 * when it exposes {@link PptxAiBridge.getDeckData}), run the transform, and
 * commit the result through the binding's existing undoable write choke points:
 *
 * - `slides` tools  -> {@link routeWrite} (staged proposal, or applied when the
 *   write policy is `auto`), so element/table/chart/smartart/etc. edits are
 *   reviewable and land as one Ctrl+Z.
 * - `theme`  tools  -> {@link PptxAiBridge.applyTheme} (immediate + undoable,
 *   matching the "theme is the exception to staging" rule).
 * - `deck`   tools  -> {@link PptxAiBridge.applyDeckData} for presentation-level
 *   state (metadata, sections, canvas size, presentation properties, layouts);
 *   reported as unavailable when the binding does not implement that optional
 *   seam, while every slide/theme tool keeps working.
 * - `read`   tools  -> return the tool's result value, no commit.
 */

import type { PptxData } from 'pptx-viewer-core';
import type { ToolContext, ToolResult } from 'pptx-viewer-mcp';

import type { AiToolContext } from './executor-base';
import { routeWrite } from './executor-base';

/** How a shared tool's output is committed to the live deck. */
export type SharedToolCommit = 'read' | 'slides' | 'theme' | 'deck';

/** An MCP tool function: a `PptxData` transform. Params exclude `filePath`. */
export type SharedToolFn = (
	ctx: ToolContext,
	params: never,
) => ToolResult<unknown> | Promise<ToolResult<unknown>>;

/** Registry metadata needed to run and commit one shared tool. */
export interface SharedToolSpec {
	/** The `pptx-viewer-mcp` tool function. */
	fn: SharedToolFn;
	/** Commit strategy for the tool's `PptxData` output. */
	commit: SharedToolCommit;
	/** History-entry / proposal label used when the tool writes. */
	label: string;
	/** Force explicit approval before applying (e.g. slide deletion). */
	forceApproval?: boolean;
}

/** Assemble a working PptxData from the bridge's live state (no live-ref mutation). */
function buildWorkingData(ctx: AiToolContext): PptxData {
	const meta = ctx.bridge.getDeckMeta();
	const base = ctx.bridge.getDeckData?.();
	const working: PptxData = base
		? structuredClone(base)
		: ({ slides: [], width: meta.width, height: meta.height } as PptxData);
	working.slides = structuredClone(ctx.bridge.getSlides());
	working.theme = ctx.bridge.getTheme() ?? working.theme;
	working.width = meta.width;
	working.height = meta.height;
	return working;
}

/** Spread a tool result value into an object so we can annotate it with write status. */
function asObject(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object'
		? (value as Record<string, unknown>)
		: { result: value };
}

/**
 * Run one `pptx-viewer-mcp` tool against the live deck and commit per its
 * {@link SharedToolSpec.commit} strategy. Returns a JSON-serialisable value for
 * the model: the tool's own result for reads, plus write-routing status
 * (`staged` / `applied` / `proposalId` / `summary`) for writes.
 */
export async function runSharedTool(
	ctx: AiToolContext,
	spec: SharedToolSpec,
	input: unknown,
): Promise<unknown> {
	const working = buildWorkingData(ctx);
	const toolCtx: ToolContext = { pptxData: working };
	const res = await spec.fn(toolCtx, input as never);

	if (spec.commit === 'read' || !res.dirty) {
		return res.result;
	}
	const next = res.pptxData;

	if (spec.commit === 'theme') {
		if (next.theme) {
			ctx.bridge.applyTheme(next.theme);
		}
		return { ...asObject(res.result), applied: true };
	}

	if (spec.commit === 'deck') {
		if (!ctx.bridge.applyDeckData) {
			throw new Error(
				'This change affects presentation-level data (metadata, sections, layout, or canvas size), which this viewer cannot apply yet.',
			);
		}
		ctx.bridge.applyDeckData(() => structuredClone(next), spec.label);
		return { ...asObject(res.result), applied: true };
	}

	// commit === 'slides': route the computed next slides through the write policy.
	const nextSlides = next.slides;
	const write = routeWrite(ctx, spec.label, () => structuredClone(nextSlides), spec.forceApproval);
	return { ...asObject(res.result), ...write };
}
