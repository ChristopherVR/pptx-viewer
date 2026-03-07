import React from "react";

import { cn } from "../utils";

interface LoadingStateProps {
  className?: string;
}

export function LoadingState({
  className,
}: LoadingStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        "h-full w-full flex items-center justify-center text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <span>Loading presentation...</span>
      </div>
    </div>
  );
}
