import React, { useRef, useEffect, useCallback } from "react";
import {
  LuSearch,
  LuReplace,
  LuChevronUp,
  LuChevronDown,
  LuX,
  LuCaseSensitive,
} from "react-icons/lu";

export interface FindReplacePanelProps {
  findQuery: string;
  replaceQuery: string;
  findMatchCase: boolean;
  findResults: Array<{
    slideIndex: number;
    elementId: string;
    segmentIndex: number;
    startOffset: number;
    length: number;
  }>;
  findResultIndex: number;
  onSetFindQuery: (query: string) => void;
  onSetReplaceQuery: (query: string) => void;
  onSetFindMatchCase: (matchCase: boolean) => void;
  onPerformFind: () => void;
  onNavigateResult: (direction: 1 | -1) => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

const ic = "w-3.5 h-3.5";
const btnBase =
  "inline-flex items-center justify-center rounded p-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const btnGhost = `${btnBase} hover:bg-accent text-muted-foreground hover:text-foreground`;
const btnAction = `${btnBase} px-2 py-1 bg-muted hover:bg-accent text-foreground text-xs`;

export function FindReplacePanel({
  findQuery,
  replaceQuery,
  findMatchCase,
  findResults,
  findResultIndex,
  onSetFindQuery,
  onSetReplaceQuery,
  onSetFindMatchCase,
  onPerformFind,
  onNavigateResult,
  onReplace,
  onReplaceAll,
  onClose,
}: FindReplacePanelProps): React.ReactElement {
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* Auto-focus on mount */
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  /* Re-run search when query or case-sensitivity changes */
  useEffect(() => {
    onPerformFind();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findQuery, findMatchCase]);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "Enter") {
        if (event.shiftKey) {
          onNavigateResult(-1);
        } else {
          onNavigateResult(1);
        }
      }
    },
    [onClose, onNavigateResult],
  );

  const handleReplaceKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "Enter") {
        onReplace();
      }
    },
    [onClose, onReplace],
  );

  const hasResults = findResults.length > 0;
  const matchCountLabel = hasResults
    ? `${findResultIndex + 1} of ${findResults.length}`
    : findQuery.length > 0
      ? "No matches"
      : "";

  return (
    <div className="absolute top-2 right-2 z-40 bg-popover border border-border rounded-lg shadow-lg p-3 text-xs text-foreground w-80 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm inline-flex items-center gap-1.5">
          <LuSearch className={ic} />
          Find & Replace
        </span>
        <button
          type="button"
          className={btnGhost}
          onClick={onClose}
          title="Close (Escape)"
          aria-label="Close find and replace"
        >
          <LuX className={ic} />
        </button>
      </div>

      {/* Search row */}
      <div className="flex items-center gap-1 mb-1.5">
        <div className="relative flex-1">
          <input
            ref={searchInputRef}
            type="text"
            value={findQuery}
            onChange={(e) => onSetFindQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Find…"
            className="w-full bg-muted border border-border rounded px-2 py-1 pr-7 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
            aria-label="Search text"
          />
          <button
            type="button"
            className={`absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${
              findMatchCase
                ? "bg-primary/80 text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            onClick={() => onSetFindMatchCase(!findMatchCase)}
            title="Match case"
            aria-label="Toggle match case"
            aria-pressed={findMatchCase}
          >
            <LuCaseSensitive className={ic} />
          </button>
        </div>
        <button
          type="button"
          className={btnGhost}
          onClick={() => onNavigateResult(-1)}
          disabled={!hasResults}
          title="Previous match (Shift+Enter)"
          aria-label="Previous match"
        >
          <LuChevronUp className={ic} />
        </button>
        <button
          type="button"
          className={btnGhost}
          onClick={() => onNavigateResult(1)}
          disabled={!hasResults}
          title="Next match (Enter)"
          aria-label="Next match"
        >
          <LuChevronDown className={ic} />
        </button>
      </div>

      {/* Match count */}
      {matchCountLabel && (
        <div className="text-[11px] text-muted-foreground mb-2 pl-0.5 tabular-nums">
          {matchCountLabel}
        </div>
      )}

      {/* Replace row */}
      <div className="flex items-center gap-1 mb-2">
        <div className="relative flex-1">
          <LuReplace className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => onSetReplaceQuery(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder="Replace with…"
            className="w-full bg-muted border border-border rounded pl-7 pr-2 py-1 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
            aria-label="Replacement text"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={btnAction}
          onClick={onReplace}
          disabled={!hasResults}
          title="Replace current match"
        >
          Replace
        </button>
        <button
          type="button"
          className={btnAction}
          onClick={onReplaceAll}
          disabled={!hasResults}
          title="Replace all matches"
        >
          Replace All
        </button>
      </div>
    </div>
  );
}
