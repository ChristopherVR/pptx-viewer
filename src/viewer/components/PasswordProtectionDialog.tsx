import React, { useState, useCallback, useMemo } from "react";
import { LuLock, LuShieldCheck, LuX, LuEye, LuEyeOff } from "react-icons/lu";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PasswordProtectionDialogProps {
  isOpen: boolean;
  isCurrentlyProtected: boolean;
  onClose: () => void;
  onSetPassword: (password: string) => void;
  onRemovePassword: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a strength score 0-4 for a password. */
function getPasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

const STRENGTH_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PasswordProtectionDialog({
  isOpen,
  isCurrentlyProtected,
  onClose,
  onSetPassword,
  onRemovePassword,
}: PasswordProtectionDialogProps): React.ReactElement | null {
  const { t } = useTranslation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const strengthLabel = useMemo(() => {
    const labels = [
      t("pptx.security.strengthVeryWeak"),
      t("pptx.security.strengthWeak"),
      t("pptx.security.strengthFair"),
      t("pptx.security.strengthStrong"),
      t("pptx.security.strengthVeryStrong"),
    ];
    return password ? labels[strength] : "";
  }, [strength, password, t]);

  const handleSubmit = useCallback(() => {
    setError("");
    if (!password) {
      setError(t("pptx.security.errorPasswordRequired"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("pptx.security.errorPasswordMismatch"));
      return;
    }
    if (password.length < 4) {
      setError(t("pptx.security.errorPasswordTooShort"));
      return;
    }
    onSetPassword(password);
    setPassword("");
    setConfirmPassword("");
    onClose();
  }, [password, confirmPassword, onSetPassword, onClose, t]);

  const handleRemove = useCallback(() => {
    onRemovePassword();
    setPassword("");
    setConfirmPassword("");
    onClose();
  }, [onRemovePassword, onClose]);

  const handleClose = useCallback(() => {
    setPassword("");
    setConfirmPassword("");
    setError("");
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/60"
        aria-label={t("common.close")}
        onClick={handleClose}
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[420px] rounded-xl border border-border bg-popover backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <LuLock className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                {t("pptx.security.protectPresentation")}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded hover:bg-accent transition-colors"
              aria-label={t("common.close")}
            >
              <LuX className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {isCurrentlyProtected && (
              <div className="flex items-center gap-2 rounded-lg bg-green-900/30 border border-green-700/40 px-3 py-2">
                <LuShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-xs text-green-300">
                  {t("pptx.security.currentlyProtected")}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {t("pptx.security.description")}
            </p>

            {/* Password field */}
            <div>
              <label className="block text-xs text-foreground mb-1">
                {t("pptx.security.password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  placeholder={t("pptx.security.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <LuEyeOff className="w-4 h-4" />
                  ) : (
                    <LuEye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Strength indicator */}
            {password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={`str-${i}`}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength ? STRENGTH_COLORS[strength] : "bg-accent"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {strengthLabel}
                </p>
              </div>
            )}

            {/* Confirm password */}
            <div>
              <label className="block text-xs text-foreground mb-1">
                {t("pptx.security.confirmPassword")}
              </label>
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                placeholder={t("pptx.security.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
              />
            </div>

            {/* Error */}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/60">
            <div>
              {isCurrentlyProtected && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  {t("pptx.security.removePassword")}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/80 transition-colors"
              >
                {isCurrentlyProtected
                  ? t("pptx.security.updatePassword")
                  : t("pptx.security.setPassword")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
