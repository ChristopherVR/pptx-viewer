import { EQUATION_TEMPLATES, sanitizeMathMl } from 'pptx-viewer-shared';
import React, { useState, useMemo, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';

import { useModalDismissDrag } from '../hooks';
import { useModalFocus } from '../hooks/useModalFocus';
import { cn } from '../utils';
import { convertLatexToOmml, convertOmmlToLatex } from '../utils/latex-to-omml';
import { convertOmmlToMathMl } from '../utils/omml-to-mathml';
import type { OmmlNode } from '../utils/omml-to-mathml';

// ── Equation templates ────────────────────────────────────────────────────

/**
 * Pre-defined equation templates covering common mathematical formulas
 * (shared across every binding's equation dialog).
 */
const TEMPLATES = EQUATION_TEMPLATES;

/** Pre-computed MathML strings for each template (computed once at module load). */
const TEMPLATE_MATHML: string[] = TEMPLATES.map((tmpl) => {
	try {
		const tmplOmml = convertLatexToOmml(tmpl.latex);
		const raw = convertOmmlToMathMl(tmplOmml as OmmlNode);
		return raw ? sanitizeMathMl(raw) : '';
	} catch {
		return '';
	}
});

// ── MathML preview renderer ──────────────────────────────────────────────

/**
 * Renders a MathML string into the DOM via `innerHTML`.
 *
 * Uses a ref-based approach because React cannot render MathML natively.
 * The container is updated whenever the `mathml` prop changes.
 *
 * @param props.mathml - The MathML markup string to render.
 */
function MathMlPreview({ mathml }: { mathml: string }) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!containerRef.current) {
			return;
		}
		if (mathml) {
			containerRef.current.innerHTML = sanitizeMathMl(mathml);
		} else {
			containerRef.current.innerHTML = '';
		}
	}, [mathml]);

	return (
		<div
			ref={containerRef}
			className='flex items-center justify-center min-h-[80px] text-2xl text-foreground'
			style={{ fontFamily: '"Cambria Math", "STIX Two Math", serif' }}
		/>
	);
}

// ── Dialog ───────────────────────────────────────────────────────────────

/**
 * Props for the {@link EquationEditorDialog} component.
 */
export interface EquationEditorDialogProps {
	isOpen: boolean;
	onClose: () => void;
	/** Called with the OMML object to insert/update on the slide. */
	onInsert: (omml: Record<string, unknown>) => void;
	/** When editing an existing equation, provide its OMML here. */
	existingOmml?: Record<string, unknown> | null;
}

/**
 * Modal dialog for inserting or editing LaTeX-based equations.
 *
 * The dialog provides:
 * - A live MathML preview rendered from the LaTeX input.
 * - A textarea for entering / editing LaTeX source.
 * - A grid of clickable equation templates.
 * - Keyboard shortcut support (Ctrl+Enter to insert, Escape to close).
 *
 * Internally converts LaTeX to OMML (Office Math Markup Language) and
 * then to MathML for the live preview. The final OMML object is passed
 * to the parent via `onInsert`.
 *
 * @param props - {@link EquationEditorDialogProps}
 * @returns The dialog element, or `null` when `isOpen` is `false`.
 */
export function EquationEditorDialog({
	isOpen,
	onClose,
	onInsert,
	existingOmml,
}: EquationEditorDialogProps): React.ReactElement | null {
	const { t } = useTranslation();
	const { panelStyle, handlers: dragHandlers } = useModalDismissDrag(onClose);

	// Derive initial LaTeX from existing OMML if provided
	const initialLatex = useMemo(() => {
		if (!existingOmml) {
			return '';
		}
		return convertOmmlToLatex(existingOmml);
	}, [existingOmml]);

	const [latex, setLatex] = useState(initialLatex);
	// Defer the latex value used for the (relatively expensive) MathML compute
	// path so rapid keystrokes stay responsive.
	const deferredLatex = useDeferredValue(latex);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	useModalFocus(isOpen, dialogRef, onClose, textareaRef);

	// Reset latex when the dialog opens with new OMML
	useEffect(() => {
		if (isOpen) {
			setLatex(initialLatex);
		}
	}, [isOpen, initialLatex]);

	// Convert LaTeX -> OMML -> MathML for live preview
	const { mathml, omml } = useMemo(() => {
		if (!deferredLatex.trim()) {
			return { mathml: '', omml: {} };
		}
		try {
			const ommlObj = convertLatexToOmml(deferredLatex);
			const mathmlStr = convertOmmlToMathMl(ommlObj as OmmlNode);
			return { mathml: mathmlStr, omml: ommlObj };
		} catch {
			return { mathml: '', omml: {} };
		}
	}, [deferredLatex]);

	const handleInsert = useCallback(() => {
		if (!latex.trim()) {
			return;
		}
		// Recompute from the current `latex` value rather than the deferred `omml`
		// to avoid inserting stale OMML when the user types and clicks quickly.
		let insertOmml = omml;
		try {
			const fresh = convertLatexToOmml(latex);
			if (fresh && Object.keys(fresh).length > 0) {
				insertOmml = fresh;
			}
		} catch {
			// fall back to deferred omml
		}
		onInsert(insertOmml);
		onClose();
	}, [latex, omml, onInsert, onClose]);

	const handleTemplateClick = useCallback((templateLatex: string) => {
		setLatex(templateLatex);
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleInsert();
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		},
		[handleInsert, onClose],
	);

	if (!isOpen) {
		return null;
	}

	const isEditing = Boolean(existingOmml);
	const hasContent = latex.trim().length > 0 && Object.keys(omml).length > 0;

	return (
		<div
			className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm'
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					onClose();
				}
			}}
			onKeyDown={handleKeyDown}
		>
			{/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation only, so a click inside the panel doesn't bubble to the backdrop's close handler or the canvas's click-outside deselect logic; the panel has no interactive semantics of its own */}
			<div
				ref={dialogRef}
				style={panelStyle}
				className='bg-background border border-border rounded-xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col overflow-hidden max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-h-[88dvh] max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]'
				onClick={(e) => e.stopPropagation()}
				role='dialog'
				aria-modal='true'
				tabIndex={-1}
				aria-label={
					isEditing
						? t('pptx.equation.editTitle', 'Edit Equation')
						: t('pptx.equation.insertTitle', 'Insert Equation')
				}
			>
				{/* Header — also a swipe-down-to-dismiss grab region on touch. */}
				<div
					{...dragHandlers}
					className='flex items-center justify-between px-5 py-3 border-b border-border touch-none'
				>
					<h2 className='text-sm font-semibold text-foreground'>
						{isEditing
							? t('pptx.equation.editTitle', 'Edit Equation')
							: t('pptx.equation.insertTitle', 'Insert Equation')}
					</h2>
					<button
						type='button'
						onClick={onClose}
						className='p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors'
						aria-label={t('pptx.settings.close')}
					>
						<LuX className='w-4 h-4' />
					</button>
				</div>

				{/* Body */}
				<div className='flex-1 overflow-y-auto px-5 py-4 space-y-4'>
					{/* Live preview */}
					<div className='rounded-lg border border-border bg-muted/60 p-4 min-h-[80px] flex items-center justify-center'>
						{hasContent ? (
							<MathMlPreview mathml={mathml} />
						) : (
							<span className='text-sm text-muted-foreground italic'>
								{t('pptx.equation.previewPlaceholder', 'Equation preview will appear here')}
							</span>
						)}
					</div>

					{/* LaTeX input */}
					<div>
						<label className='block text-xs font-medium text-muted-foreground mb-1.5'>
							{t('pptx.equation.latexInput', 'LaTeX Input')}
						</label>
						<textarea
							ref={textareaRef}
							value={latex}
							onChange={(e) => setLatex(e.target.value)}
							placeholder='\\frac{a}{b} + \\sqrt{c}'
							className='w-full h-24 px-3 py-2 rounded-lg border border-border bg-muted text-foreground text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground'
							spellCheck={false}
						/>
						<p className='mt-1 text-[11px] text-muted-foreground'>
							{t('pptx.equation.latexHint', 'Use LaTeX syntax. Ctrl+Enter to insert.')}
						</p>
					</div>

					{/* Templates */}
					<div>
						<h3 className='text-xs font-medium text-muted-foreground mb-2'>
							{t('pptx.equation.templates', 'Common Templates')}
						</h3>
						<div className='grid grid-cols-4 gap-1.5'>
							{TEMPLATES.map((tmpl, idx) => {
								const tmplMathml = TEMPLATE_MATHML[idx];
								return (
									<button
										key={tmpl.latex}
										type='button'
										onClick={() => handleTemplateClick(tmpl.latex)}
										className={cn(
											'flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors',
											latex === tmpl.latex
												? 'border-primary bg-primary/10'
												: 'border-border bg-muted/40 hover:bg-accent/60 hover:border-border',
										)}
										title={t(tmpl.i18nKey, tmpl.label)}
									>
										<div
											className='text-sm text-foreground h-8 flex items-center justify-center overflow-hidden'
											style={{
												fontFamily: '"Cambria Math", "STIX Two Math", serif',
											}}
											dangerouslySetInnerHTML={{ __html: tmplMathml }}
										/>
										<span className='text-[10px] text-muted-foreground truncate w-full text-center'>
											{t(tmpl.i18nKey, tmpl.label)}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className='flex items-center justify-end gap-2 px-5 py-3 border-t border-border'>
					<button
						type='button'
						onClick={onClose}
						className='px-4 py-1.5 rounded-lg text-xs text-foreground hover:bg-accent transition-colors'
					>
						{t('pptx.equation.cancel', 'Cancel')}
					</button>
					<button
						type='button'
						onClick={handleInsert}
						disabled={!hasContent}
						className='px-4 py-1.5 rounded-lg text-xs font-medium bg-primary hover:bg-primary/80 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
					>
						{isEditing ? t('pptx.equation.update', 'Update') : t('pptx.equation.insert', 'Insert')}
					</button>
				</div>
			</div>
		</div>
	);
}
