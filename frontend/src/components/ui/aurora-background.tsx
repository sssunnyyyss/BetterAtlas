"use client";

import { cn } from "../../lib/utils.js";
import React from "react";

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  showRadialGradient?: boolean;
}

export function AuroraBackground({
  className,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) {
  return (
    <div
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
      aria-hidden="true"
      {...props}
    >
      <div
        className={cn(
          `absolute -inset-[10px] opacity-55 blur-[10px] will-change-transform
          [--white:rgba(255,255,255,0.95)]
          [--transparent:transparent]
          [--aurora:repeating-linear-gradient(100deg,rgba(210,176,0,0.22)_8%,rgba(99,132,198,0.28)_15%,rgba(0,40,120,0.2)_22%,rgba(232,213,133,0.24)_30%,rgba(99,132,198,0.3)_38%)]
          [background-image:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%),var(--aurora)]
          [background-size:300%,_200%]
          [background-position:50%_50%,50%_50%]
          after:content-[""] after:absolute after:inset-0
          after:[background-image:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%),var(--aurora)]
          after:[background-size:200%,_100%]
          after:[background-attachment:fixed]
          after:mix-blend-multiply
          after:[animation:ba-aurora_60s_linear_infinite]`,
          showRadialGradient
            ? "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]"
            : ""
        )}
      />
    </div>
  );
}
