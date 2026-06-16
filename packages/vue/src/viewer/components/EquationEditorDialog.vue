<script setup lang="ts">
import DOMPurify from 'dompurify';
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import type { OmmlNode } from 'pptx-viewer-shared';
import { convertLatexToOmml, convertOmmlToLatex, convertOmmlToMathMl } from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';

import ModalDialog from './ModalDialog.vue';

/**
 * EquationEditorDialog — LaTeX input with a live MathML preview for inserting or
 * editing an OMML equation.
 *
 * Vue port of the React `EquationEditorDialog.tsx`. The user types LaTeX (or
 * picks a template); it is converted LaTeX → OMML (`convertLatexToOmml`) → MathML
 * (`convertOmmlToMathMl`, reused from `pptx-viewer-shared`, the same path
 * `EquationRenderer` uses) for the live preview. On confirm it emits both:
 *
 *  - `insert(element)` — a ready-to-add core {@link PptxElement} (a shape
 *    carrying the equation as a `textSegments[].equationXml` OMML tree, so
 *    `SmartArtRenderer`/`EquationRenderer` render it directly). Route to
 *    `ops.addElement`.
 *  - `apply(segment)` — the equation {@link TextSegment} alone, for updating an
 *    existing equation in place. Route to `ops.updateText` / a segment patch.
 *
 * When `existingOmml` is supplied the dialog opens in edit mode, seeding the
 * textarea from the reverse `convertOmmlToLatex`.
 */
const props = defineProps<{
	/** Whether the dialog is open. */
	open: boolean;
	/** When editing an existing equation, its OMML; otherwise null/undefined. */
	existingOmml?: Record<string, unknown> | null;
}>();

const emit = defineEmits<{
	/** Emitted with a ready-to-add equation element. */
	(e: 'insert', element: PptxElement): void;
	/** Emitted with the equation segment alone (for in-place updates). */
	(e: 'apply', segment: TextSegment): void;
	/** Emitted when the dialog should close without inserting. */
	(e: 'close'): void;
}>();

/** Pre-built equation templates (LaTeX + label). */
interface EquationTemplate {
	label: string;
	latex: string;
}

const TEMPLATES: EquationTemplate[] = [
	{ label: 'Fraction', latex: '\\frac{a}{b}' },
	{ label: 'Quadratic', latex: 'x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}' },
	{ label: 'Pythagorean', latex: 'a^{2}+b^{2}=c^{2}' },
	{ label: 'Sum', latex: '\\sum_{i=1}^{n}{a_{i}}' },
	{ label: 'Integral', latex: '\\int_{a}^{b}{f(x)}dx' },
	{ label: 'Square Root', latex: '\\sqrt{x^{2}+y^{2}}' },
	{ label: 'Limit', latex: '\\lim_{x\\to\\infty}{f(x)}' },
	{ label: "Euler's", latex: 'e^{i\\pi}+1=0' },
	{ label: 'Matrix 2x2', latex: '\\left[a,b;c,d\\right]' },
	{ label: 'Binomial', latex: '\\left(a+b\\right)^{n}' },
	{ label: 'Derivative', latex: '\\frac{dy}{dx}' },
	{ label: 'Trig Identity', latex: '\\sin^{2}\\theta+\\cos^{2}\\theta=1' },
];

/**
 * Sanitise a MathML markup string. Falls back to the raw input when
 * `DOMPurify.sanitize` is unavailable (non-DOM test environments); the XSS
 * surface only matters in real browsers.
 */
function sanitizeMathMl(markup: string): string {
	const purify = DOMPurify as unknown as {
		sanitize?: (dirty: string, cfg?: Record<string, unknown>) => string;
	};
	if (typeof purify.sanitize !== 'function') {
		return markup;
	}
	return purify.sanitize(markup, { USE_PROFILES: { mathMl: true, svg: true } });
}

/** Convert a LaTeX string to sanitised MathML; '' on failure/empty. */
function latexToMathMl(latex: string): string {
	if (!latex.trim()) {
		return '';
	}
	try {
		const omml = convertLatexToOmml(latex);
		const raw = convertOmmlToMathMl(omml as OmmlNode);
		return raw ? sanitizeMathMl(raw) : '';
	} catch {
		return '';
	}
}

/** Pre-computed MathML for each template tile. */
const templateMathMl = computed(() => TEMPLATES.map((tmpl) => latexToMathMl(tmpl.latex)));

const latex = ref('');

const isEditing = computed(() => Boolean(props.existingOmml));

/** Derive initial LaTeX from existing OMML (edit mode). */
function initialLatex(): string {
	if (!props.existingOmml) {
		return '';
	}
	try {
		return convertOmmlToLatex(props.existingOmml);
	} catch {
		return '';
	}
}

/** Re-seed the form whenever the dialog opens. */
watch(
	[() => props.open, () => props.existingOmml],
	([isOpen]) => {
		if (isOpen) {
			latex.value = initialLatex();
		}
	},
	{ immediate: true },
);

/** Live LaTeX → OMML → MathML for the preview + the segment payload. */
const computedEquation = computed<{ mathml: string; omml: Record<string, unknown> }>(() => {
	if (!latex.value.trim()) {
		return { mathml: '', omml: {} };
	}
	try {
		const omml = convertLatexToOmml(latex.value);
		const mathml = convertOmmlToMathMl(omml as OmmlNode);
		return { mathml: mathml ? sanitizeMathMl(mathml) : '', omml };
	} catch {
		return { mathml: '', omml: {} };
	}
});

/** True when there is renderable equation content to insert. */
const hasContent = computed(
	() => latex.value.trim().length > 0 && Object.keys(computedEquation.value.omml).length > 0,
);

function selectTemplate(tmplLatex: string): void {
	latex.value = tmplLatex;
}

/** Build the equation {@link TextSegment} from the current OMML. */
function buildSegment(omml: Record<string, unknown>): TextSegment {
	return {
		text: '[Equation]',
		style: { fontSize: 18, fontFamily: 'Cambria Math' } as TextStyle,
		equationXml: omml,
	};
}

/** Best-effort unique id, mirroring the core element-factory style. */
function newId(prefix: string): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${prefix}-${crypto.randomUUID()}`;
	}
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build a renderable equation element. Mirrors the React `handleInsertEquation`:
 * a shape carrying `[Equation]` text plus the equation segment.
 */
function buildEquationElement(segment: TextSegment): PptxElement {
	return {
		id: newId('shp'),
		type: 'shape',
		x: 120,
		y: 200,
		width: 400,
		height: 80,
		text: '[Equation]',
		textStyle: { fontSize: 18, fontFamily: 'Cambria Math' } as TextStyle,
		textSegments: [segment],
	} as PptxElement;
}

function confirm(): void {
	if (!hasContent.value) {
		return;
	}
	const segment = buildSegment(computedEquation.value.omml);
	emit('apply', segment);
	emit('insert', buildEquationElement(segment));
	emit('close');
}

function close(): void {
	emit('close');
}

function onTextareaKeydown(event: KeyboardEvent): void {
	if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
		event.preventDefault();
		confirm();
	}
}
</script>

<template>
	<ModalDialog :open="open" :title="isEditing ? 'Edit Equation' : 'Insert Equation'" @close="close">
		<div class="pptx-vue-equation-editor flex w-[min(82vw,600px)] flex-col gap-3.5">
			<!-- Live preview -->
			<div
				class="pptx-vue-equation-preview flex min-h-[80px] items-center justify-center rounded-md border border-border bg-muted/60 p-3"
			>
				<div
					v-if="hasContent"
					class="pptx-vue-equation-preview-math text-2xl text-foreground"
					v-html="computedEquation.mathml"
				/>
				<span
					v-else
					class="pptx-vue-equation-preview-empty text-[13px] italic text-muted-foreground"
				>
					Equation preview will appear here
				</span>
			</div>

			<!-- LaTeX input -->
			<label class="pptx-vue-equation-field flex flex-col gap-1">
				<span class="pptx-vue-equation-label text-xs font-medium text-muted-foreground"
					>LaTeX Input</span
				>
				<textarea
					v-model="latex"
					class="pptx-vue-equation-textarea w-full resize-y rounded border border-border bg-background px-2.5 py-2 font-mono text-[13px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					rows="3"
					spellcheck="false"
					placeholder="\frac{a}{b} + \sqrt{c}"
					@keydown="onTextareaKeydown"
				/>
				<span class="pptx-vue-equation-hint text-[11px] text-muted-foreground"
					>Use LaTeX syntax. Ctrl+Enter to insert.</span
				>
			</label>

			<!-- Templates -->
			<div class="pptx-vue-equation-templates-wrap flex flex-col gap-1.5">
				<span class="pptx-vue-equation-label text-xs font-medium text-muted-foreground"
					>Common Templates</span
				>
				<div class="pptx-vue-equation-templates grid grid-cols-4 gap-1.5">
					<button
						v-for="(tmpl, idx) in TEMPLATES"
						:key="tmpl.latex"
						type="button"
						class="pptx-vue-equation-template flex flex-col items-center gap-1 rounded-md border p-2 transition-colors"
						:class="
							latex === tmpl.latex
								? 'pptx-vue-equation-template--active border-primary bg-primary/10'
								: 'border-border bg-muted/40 hover:bg-accent/60'
						"
						:title="tmpl.label"
						@click="selectTemplate(tmpl.latex)"
					>
						<span
							class="pptx-vue-equation-template-math flex h-7 items-center justify-center overflow-hidden text-foreground"
							v-html="templateMathMl[idx]"
						/>
						<span
							class="pptx-vue-equation-template-label w-full truncate text-center text-[10px] text-muted-foreground"
							>{{ tmpl.label }}</span
						>
					</button>
				</div>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="pptx-vue-equation-btn pptx-vue-equation-btn--secondary rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
				@click="close"
			>
				Cancel
			</button>
			<button
				type="button"
				class="pptx-vue-equation-btn pptx-vue-equation-btn--primary rounded border border-transparent bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-45"
				:disabled="!hasContent"
				@click="confirm"
			>
				{{ isEditing ? 'Update' : 'Insert' }}
			</button>
		</template>
	</ModalDialog>
</template>

<style scoped>
/* Math glyph font — not expressible as a Tailwind utility. Matches React's
   inline `fontFamily: '"Cambria Math", "STIX Two Math", serif'`. */
.pptx-vue-equation-preview-math,
.pptx-vue-equation-template-math {
	font-family: 'Cambria Math', 'STIX Two Math', serif;
}
</style>
