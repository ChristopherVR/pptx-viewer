import React, { useState, useCallback, useMemo } from "react";
import { LuClock, LuScissors } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import type {
  MediaPptxElement,
  PptxElement,
} from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Style constants (matching InspectorPane)
// ---------------------------------------------------------------------------

const HEADING = "text-[11px] uppercase tracking-wide text-muted-foreground";
const CARD = "rounded border border-border bg-card p-2 space-y-2";
const INPUT =
  "flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full";
const BTN =
  "rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors";
const LABEL_CLS = "flex items-center justify-between gap-2";
const LABEL_TEXT = "text-muted-foreground";

// ---------------------------------------------------------------------------
// Time conversion utilities (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Convert milliseconds to a mm:ss display string.
 * E.g. 65000 → "01:05", 3661000 → "61:01" (minutes can exceed 59).
 */
export function msToMmSs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Parse a mm:ss (or m:ss, or raw seconds) string into milliseconds.
 * Returns `undefined` if the input is not parseable.
 *
 * Accepts:
 * - "1:30"  → 90000
 * - "01:30" → 90000
 * - "90"    → 90000  (treated as seconds)
 * - "1:30.5" → not supported, truncated to 1:30
 */
export function mmSsToMs(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  // mm:ss format
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx >= 0) {
    const minPart = trimmed.slice(0, colonIdx);
    const secPart = trimmed.slice(colonIdx + 1);
    const minutes = parseInt(minPart, 10);
    const seconds = parseInt(secPart, 10);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds))
      return undefined;
    if (minutes < 0 || seconds < 0 || seconds >= 60) return undefined;
    return (minutes * 60 + seconds) * 1000;
  }

  // Raw seconds
  const seconds = parseInt(trimmed, 10);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds * 1000;
}

/**
 * Validate that trim range is valid: end > start (when both are set),
 * and both are non-negative. Returns an error i18n key or null if valid.
 */
export function validateTrimRange(
  trimStartMs: number,
  trimEndMs: number,
  durationMs: number,
): string | null {
  if (trimStartMs < 0) return "pptx.media.trimErrorNegative";
  if (trimEndMs < 0) return "pptx.media.trimErrorNegative";
  if (trimEndMs > 0 && trimStartMs >= trimEndMs)
    return "pptx.media.trimErrorStartAfterEnd";
  if (durationMs > 0 && trimStartMs > durationMs)
    return "pptx.media.trimErrorBeyondDuration";
  if (durationMs > 0 && trimEndMs > durationMs)
    return "pptx.media.trimErrorBeyondDuration";
  return null;
}

// ---------------------------------------------------------------------------
// TrimTimeInput — a mm:ss text input with validation
// ---------------------------------------------------------------------------

interface TrimTimeInputProps {
  label: string;
  valueMs: number;
  maxMs: number;
  disabled: boolean;
  onChange: (ms: number) => void;
}

function TrimTimeInput({
  label,
  valueMs,
  maxMs,
  disabled,
  onChange,
}: TrimTimeInputProps): React.ReactElement {
  const [editValue, setEditValue] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const displayValue = editValue ?? msToMmSs(valueMs);

  const handleFocus = useCallback((): void => {
    setEditValue(msToMmSs(valueMs));
    setHasError(false);
  }, [valueMs]);

  const handleBlur = useCallback((): void => {
    if (editValue !== null) {
      const parsed = mmSsToMs(editValue);
      if (
        parsed !== undefined &&
        parsed >= 0 &&
        (maxMs <= 0 || parsed <= maxMs)
      ) {
        onChange(parsed);
        setHasError(false);
      } else {
        setHasError(false);
      }
    }
    setEditValue(null);
  }, [editValue, maxMs, onChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const val = e.target.value;
      setEditValue(val);
      const parsed = mmSsToMs(val);
      setHasError(parsed === undefined);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        setEditValue(null);
        setHasError(false);
      }
    },
    [],
  );

  return (
    <label className="flex flex-col gap-0.5">
      <span className={`text-[11px] ${LABEL_TEXT}`}>{label}</span>
      <input
        type="text"
        disabled={disabled}
        className={`${INPUT} text-[11px] tabular-nums ${hasError ? "border-red-400" : ""}`}
        value={displayValue}
        placeholder="00:00"
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// MediaTrimInspector — focused trim UI component
// ---------------------------------------------------------------------------

export interface MediaInspectorProps {
  element: MediaPptxElement;
  canEdit: boolean;
  durationSeconds: number;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
}

export function MediaInspector({
  element,
  canEdit,
  durationSeconds,
  onUpdateElement,
}: MediaInspectorProps): React.ReactElement {
  const { t } = useTranslation();

  const trimStartMs = element.trimStartMs ?? 0;
  const trimEndMs = element.trimEndMs ?? 0;
  const durationMs = durationSeconds * 1000;

  // Auto-calculate trimmed duration
  const trimmedDuration = useMemo((): string => {
    const effectiveStart = trimStartMs;
    const effectiveEnd = trimEndMs > 0 ? trimEndMs : durationMs;
    if (effectiveEnd <= effectiveStart || durationMs <= 0) {
      return msToMmSs(durationMs);
    }
    return msToMmSs(effectiveEnd - effectiveStart);
  }, [trimStartMs, trimEndMs, durationMs]);

  const validationError = useMemo(
    () => validateTrimRange(trimStartMs, trimEndMs, durationMs),
    [trimStartMs, trimEndMs, durationMs],
  );

  const hasTrim = trimStartMs > 0 || trimEndMs > 0;

  const handleTrimStartChange = useCallback(
    (ms: number): void => {
      onUpdateElement({
        trimStartMs: ms,
      } as Partial<PptxElement>);
    },
    [onUpdateElement],
  );

  const handleTrimEndChange = useCallback(
    (ms: number): void => {
      onUpdateElement({
        trimEndMs: ms,
      } as Partial<PptxElement>);
    },
    [onUpdateElement],
  );

  const handleResetTrim = useCallback((): void => {
    onUpdateElement({
      trimStartMs: 0,
      trimEndMs: 0,
    } as Partial<PptxElement>);
  }, [onUpdateElement]);

  return (
    <div className={CARD}>
      <div className={HEADING}>
        <LuScissors className="inline w-3 h-3 mr-1" />
        {t("pptx.media.trim")}
      </div>

      {/* Trim time inputs in mm:ss format */}
      <div className="grid grid-cols-2 gap-1.5">
        <TrimTimeInput
          label={t("pptx.media.trimStartTime")}
          valueMs={trimStartMs}
          maxMs={durationMs}
          disabled={!canEdit}
          onChange={handleTrimStartChange}
        />
        <TrimTimeInput
          label={t("pptx.media.trimEndTime")}
          valueMs={trimEndMs}
          maxMs={durationMs}
          disabled={!canEdit}
          onChange={handleTrimEndChange}
        />
      </div>

      {/* Trimmed duration display */}
      <div className={LABEL_CLS}>
        <span className={`text-[11px] ${LABEL_TEXT}`}>
          <LuClock className="inline w-3 h-3 mr-1" />
          {t("pptx.media.trimmedDuration")}
        </span>
        <span className="text-[11px] tabular-nums font-medium">
          {trimmedDuration}
        </span>
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="text-[10px] text-red-400">{t(validationError)}</div>
      )}

      {/* Reset trim button */}
      {canEdit && hasTrim && (
        <button
          type="button"
          className={`${BTN} w-full text-center`}
          onClick={handleResetTrim}
        >
          {t("pptx.media.resetTrim")}
        </button>
      )}
    </div>
  );
}
