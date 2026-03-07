import React from "react";

import { cn } from "../../utils";
import type {
  PptxCoreProperties,
  PptxAppProperties,
  PptxCustomProperty,
  PptxNotesMaster,
  PptxHandoutMaster,
} from "pptx-viewer-core";
import type { CanvasSize } from "../../types";
import { CARD, HEADING, INPUT, BTN } from "./inspector-pane-constants";

// ---------------------------------------------------------------------------
// Info Row (read-only label–value)
// ---------------------------------------------------------------------------

export function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text Field Row
// ---------------------------------------------------------------------------

function TextFieldRow({
  label,
  disabled,
  value,
  onChange,
}: {
  label: string;
  disabled: boolean;
  value: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="text"
        className={INPUT}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Custom Properties Block
// ---------------------------------------------------------------------------

function CustomPropertiesBlock({
  customProperties,
  canEdit,
  onUpdate,
}: {
  customProperties: PptxCustomProperty[];
  canEdit: boolean;
  onUpdate: (props: PptxCustomProperty[]) => void;
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Custom Properties</span>
        {canEdit && (
          <button
            type="button"
            className={BTN}
            onClick={() =>
              onUpdate([
                ...customProperties,
                {
                  name: `Property ${customProperties.length + 1}`,
                  value: "",
                  type: "lpwstr",
                },
              ])
            }
          >
            Add
          </button>
        )}
      </div>
      {customProperties.length === 0 ? (
        <div className="text-[10px] text-muted-foreground">
          No custom properties
        </div>
      ) : (
        customProperties.map((entry, index) => (
          <div
            key={`${entry.name}-${index}`}
            className="grid grid-cols-[1fr,1fr,auto] gap-1"
          >
            <input
              type="text"
              className={INPUT}
              disabled={!canEdit}
              value={entry.name}
              onChange={(e) =>
                onUpdate(
                  customProperties.map((c, i) =>
                    i === index ? { ...c, name: e.target.value } : c,
                  ),
                )
              }
            />
            <input
              type="text"
              className={INPUT}
              disabled={!canEdit}
              value={entry.value}
              onChange={(e) =>
                onUpdate(
                  customProperties.map((c, i) =>
                    i === index ? { ...c, value: e.target.value } : c,
                  ),
                )
              }
            />
            {canEdit && (
              <button
                type="button"
                className={cn(BTN, "px-1.5 text-red-400 hover:text-red-300")}
                onClick={() =>
                  onUpdate(customProperties.filter((_, i) => i !== index))
                }
              >
                ×
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes & Handout Card
// ---------------------------------------------------------------------------

export function NotesHandoutCard({
  notesCanvasSize,
  notesMaster,
  handoutMaster,
}: {
  notesCanvasSize: CanvasSize | undefined;
  notesMaster: PptxNotesMaster | undefined;
  handoutMaster: PptxHandoutMaster | undefined;
}): React.ReactElement {
  return (
    <div className={CARD}>
      <div className={HEADING}>Notes & Handout</div>
      <div className="space-y-1 text-[11px] text-muted-foreground">
        <InfoRow
          label="Notes Size"
          value={
            notesCanvasSize
              ? `${notesCanvasSize.width} × ${notesCanvasSize.height}px`
              : "Not available"
          }
        />
        <InfoRow
          label="Notes Master"
          value={
            notesMaster
              ? `${notesMaster.placeholders?.length ?? 0} placeholders`
              : "Not available"
          }
        />
        <InfoRow
          label="Handout Master"
          value={
            handoutMaster
              ? `${handoutMaster.placeholders?.length ?? 0} placeholders`
              : "Not available"
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document Properties Card
// ---------------------------------------------------------------------------

export function DocumentPropertiesCard({
  coreProperties,
  appProperties,
  customProperties,
  canEdit,
  onUpdateCoreProperties,
  onUpdateAppProperties,
  onUpdateCustomProperties,
}: {
  coreProperties: PptxCoreProperties | undefined;
  appProperties: PptxAppProperties | undefined;
  customProperties: PptxCustomProperty[];
  canEdit: boolean;
  onUpdateCoreProperties: (patch: Partial<PptxCoreProperties>) => void;
  onUpdateAppProperties: (patch: Partial<PptxAppProperties>) => void;
  onUpdateCustomProperties: (props: PptxCustomProperty[]) => void;
}): React.ReactElement {
  return (
    <div className={CARD}>
      <div className={HEADING}>Document</div>
      <div className="space-y-2 text-[11px] text-muted-foreground">
        <TextFieldRow
          label="Title"
          disabled={!canEdit}
          value={coreProperties?.title ?? ""}
          onChange={(v) => onUpdateCoreProperties({ title: v })}
        />
        <TextFieldRow
          label="Author"
          disabled={!canEdit}
          value={coreProperties?.creator ?? ""}
          onChange={(v) => onUpdateCoreProperties({ creator: v })}
        />
        <TextFieldRow
          label="Company"
          disabled={!canEdit}
          value={appProperties?.company ?? ""}
          onChange={(v) => onUpdateAppProperties({ company: v })}
        />
        <TextFieldRow
          label="Application"
          disabled={!canEdit}
          value={appProperties?.application ?? ""}
          onChange={(v) => onUpdateAppProperties({ application: v })}
        />
        <CustomPropertiesBlock
          customProperties={customProperties}
          canEdit={canEdit}
          onUpdate={onUpdateCustomProperties}
        />
      </div>
    </div>
  );
}
