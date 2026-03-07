import React from "react";
import { LuShieldCheck } from "react-icons/lu";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignatureStatusBadgeProps {
  hasSignatures: boolean;
  signatureCount: number;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A small toolbar badge indicating the document is digitally signed.
 * Renders nothing when no signatures are present.
 */
export function SignatureStatusBadge({
  hasSignatures,
  signatureCount,
  onClick,
}: SignatureStatusBadgeProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (!hasSignatures || signatureCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-green-900/30 border border-green-700/40 text-green-300 hover:bg-green-900/50 transition-colors"
      title={t("pptx.digitalSignatures.signatureCount", {
        count: signatureCount,
      })}
    >
      <LuShieldCheck className="w-3.5 h-3.5" />
      <span>{t("pptx.digitalSignatures.badge")}</span>
    </button>
  );
}
