import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import { cn } from "../utils";
import { convertLatexToOmml, convertOmmlToLatex } from "../utils/latex-to-omml";
import { convertOmmlToMathMl } from "../utils/omml-to-mathml";
import type { OmmlNode } from "../utils/omml-to-mathml";

// ── Equation templates ────────────────────────────────────────────────────

/** Describes a pre-built equation template shown in the template gallery. */
interface EquationTemplate {
  /** Human-readable label (English fallback). */
  label: string;
  /** LaTeX source for the template equation. */
  latex: string;
  /** i18n translation key for the template name. */
  i18nKey: string;
}

/** Pre-defined equation templates covering common mathematical formulas. */
const TEMPLATES: EquationTemplate[] = [
  {
    label: "Fraction",
    latex: "\\frac{a}{b}",
    i18nKey: "pptx.equation.template.fraction",
  },
  {
    label: "Quadratic",
    latex: "x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}",
    i18nKey: "pptx.equation.template.quadratic",
  },
  {
    label: "Pythagorean",
    latex: "a^{2}+b^{2}=c^{2}",
    i18nKey: "pptx.equation.template.pythagorean",
  },
  {
    label: "Sum",
    latex: "\\sum_{i=1}^{n}{a_{i}}",
    i18nKey: "pptx.equation.template.sum",
  },
  {
    label: "Integral",
    latex: "\\int_{a}^{b}{f(x)}dx",
    i18nKey: "pptx.equation.template.integral",
  },
  {
    label: "Square Root",
    latex: "\\sqrt{x^{2}+y^{2}}",
    i18nKey: "pptx.equation.template.squareRoot",
  },
  {
    label: "Limit",
    latex: "\\lim_{x\\to\\infty}{f(x)}",
    i18nKey: "pptx.equation.template.limit",
  },
  {
    label: "Euler's",
    latex: "e^{i\\pi}+1=0",
    i18nKey: "pptx.equation.template.euler",
  },
  {
    label: "Matrix 2x2",
    latex: "\\left[a,b;c,d\\right]",
    i18nKey: "pptx.equation.template.matrix",
  },
  {
    label: "Binomial",
    latex: "\\left(a+b\\right)^{n}",
    i18nKey: "pptx.equation.template.binomial",
  },
  {
    label: "Derivative",
    latex: "\\frac{dy}{dx}",
    i18nKey: "pptx.equation.template.derivative",
  },
  {
    label: "Trig Identity",
    latex: "\\sin^{2}\\theta+\\cos^{2}\\theta=1",
    i18nKey: "pptx.equation.template.trigIdentity",
  },
];

/** Pre-computed MathML strings for each template (computed once at module load). */
const TEMPLATE_MATHML: string[] = TEMPLATES.map((tmpl) => {
  try {
    const tmplOmml = convertLatexToOmml(tmpl.latex);
    return convertOmmlToMathMl(tmplOmml as OmmlNode);
  } catch {
    return "";
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
    if (!containerRef.current) return;
    if (mathml) {
      containerRef.current.innerHTML = mathml;
    } else {
      containerRef.current.innerHTML = "";
    }
  }, [mathml]);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center min-h-[80px] text-2xl text-foreground"
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

  // Derive initial LaTeX from existing OMML if provided
  const initialLatex = useMemo(() => {
    if (!existingOmml) return "";
    return convertOmmlToLatex(existingOmml);
  }, [existingOmml]);

  const [latex, setLatex] = useState(initialLatex);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset latex when the dialog opens with new OMML
  useEffect(() => {
    if (isOpen) {
      setLatex(initialLatex);
      // Focus the textarea after a short delay to allow the dialog to mount
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, initialLatex]);

  // Convert LaTeX -> OMML -> MathML for live preview
  const { mathml, omml } = useMemo(() => {
    if (!latex.trim()) return { mathml: "", omml: {} };
    try {
      const ommlObj = convertLatexToOmml(latex);
      const mathmlStr = convertOmmlToMathMl(ommlObj as OmmlNode);
      return { mathml: mathmlStr, omml: ommlObj };
    } catch {
      return { mathml: "", omml: {} };
    }
  }, [latex]);

  const handleInsert = useCallback(() => {
    if (!latex.trim()) return;
    onInsert(omml);
    onClose();
  }, [latex, omml, onInsert, onClose]);

  const handleTemplateClick = useCallback((templateLatex: string) => {
    setLatex(templateLatex);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleInsert();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [handleInsert, onClose],
  );

  if (!isOpen) return null;

  const isEditing = Boolean(existingOmml);
  const hasContent = latex.trim().length > 0 && Object.keys(omml).length > 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            {isEditing
              ? t("pptx.equation.editTitle", "Edit Equation")
              : t("pptx.equation.insertTitle", "Insert Equation")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Live preview */}
          <div className="rounded-lg border border-border bg-muted/60 p-4 min-h-[80px] flex items-center justify-center">
            {hasContent ? (
              <MathMlPreview mathml={mathml} />
            ) : (
              <span className="text-sm text-muted-foreground italic">
                {t(
                  "pptx.equation.previewPlaceholder",
                  "Equation preview will appear here",
                )}
              </span>
            )}
          </div>

          {/* LaTeX input */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t("pptx.equation.latexInput", "LaTeX Input")}
            </label>
            <textarea
              ref={textareaRef}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="\\frac{a}{b} + \\sqrt{c}"
              className="w-full h-24 px-3 py-2 rounded-lg border border-border bg-muted text-foreground text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t(
                "pptx.equation.latexHint",
                "Use LaTeX syntax. Ctrl+Enter to insert.",
              )}
            </p>
          </div>

          {/* Templates */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">
              {t("pptx.equation.templates", "Common Templates")}
            </h3>
            <div className="grid grid-cols-4 gap-1.5">
              {TEMPLATES.map((tmpl, idx) => {
                const tmplMathml = TEMPLATE_MATHML[idx];
                return (
                  <button
                    key={tmpl.latex}
                    type="button"
                    onClick={() => handleTemplateClick(tmpl.latex)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors",
                      latex === tmpl.latex
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/40 hover:bg-accent/60 hover:border-border",
                    )}
                    title={t(tmpl.i18nKey, tmpl.label)}
                  >
                    <div
                      className="text-sm text-foreground h-8 flex items-center justify-center overflow-hidden"
                      style={{
                        fontFamily: '"Cambria Math", "STIX Two Math", serif',
                      }}
                      dangerouslySetInnerHTML={{ __html: tmplMathml }}
                    />
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                      {t(tmpl.i18nKey, tmpl.label)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs text-foreground hover:bg-accent transition-colors"
          >
            {t("pptx.equation.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!hasContent}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-primary hover:bg-primary/80 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isEditing
              ? t("pptx.equation.update", "Update")
              : t("pptx.equation.insert", "Insert")}
          </button>
        </div>
      </div>
    </div>
  );
}
