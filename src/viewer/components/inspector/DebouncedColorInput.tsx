import React, { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// DebouncedColorInput
// ---------------------------------------------------------------------------
// A colour-picker that only commits when the user releases the picker or
// blurs the input, avoiding noisy intermediate updates while dragging.
// ---------------------------------------------------------------------------

interface DebouncedColorInputProps {
  value: string;
  disabled?: boolean;
  className?: string;
  onCommit: (hex: string) => void;
}

export function DebouncedColorInput({
  value,
  disabled,
  className,
  onCommit,
}: DebouncedColorInputProps): React.ReactElement {
  const [local, setLocal] = useState(value);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  // Sync external value when the selected element changes
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocal(e.target.value);
  }, []);

  // Commit on blur or when the picker closes (which triggers blur)
  const handleBlur = useCallback(() => {
    commitRef.current(local);
  }, [local]);

  // Also commit on native "change" event end (mouse-up from the picker)
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = () => {
      commitRef.current(el.value);
    };
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);

  return (
    <input
      ref={inputRef}
      type="color"
      disabled={disabled}
      value={local}
      className={className}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
