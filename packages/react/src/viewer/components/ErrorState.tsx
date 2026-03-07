import React from "react";

import { cn } from "../utils";

interface ErrorStateProps {
  className?: string;
  error: string;
}

export function ErrorState({
  className,
  error,
}: ErrorStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        "h-full w-full flex items-center justify-center p-6 text-center text-red-400",
        className,
      )}
    >
      {error}
    </div>
  );
}
