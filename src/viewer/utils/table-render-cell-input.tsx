import React, { useRef, useEffect } from "react";

/**
 * Inline cell text editor used when a table cell enters editing mode.
 */
export function TableCellInput({
  initialText,
  style,
  onCommit,
  onCancel,
}: {
  initialText: string;
  style?: React.CSSProperties;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus and select all text when entering edit mode
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={initialText}
      className="w-full bg-transparent outline-none"
      style={{
        ...style,
        padding: 0,
        margin: 0,
        border: "none",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={(e) => onCommit(e.currentTarget.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        } else if (e.key === "Enter") {
          e.preventDefault();
          onCommit(e.currentTarget.value);
        } else if (e.key === "Tab") {
          e.preventDefault();
          onCommit(e.currentTarget.value);
        }
      }}
    />
  );
}
