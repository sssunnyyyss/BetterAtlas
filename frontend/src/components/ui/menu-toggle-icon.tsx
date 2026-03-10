'use client';

import React from 'react';
import { cn } from '../../lib/utils.js';

type MenuToggleProps = React.ComponentProps<'svg'> & {
  open: boolean;
  duration?: number;
};

export function MenuToggleIcon({
  open,
  className,
  fill = 'none',
  stroke = 'currentColor',
  strokeWidth = 2.3,
  strokeLinecap = 'round',
  strokeLinejoin = 'round',
  duration = 380,
  ...props
}: MenuToggleProps) {
  return (
    <svg
      strokeWidth={strokeWidth}
      fill={fill}
      stroke={stroke}
      viewBox="0 0 24 24"
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
      data-state={open ? 'open' : 'closed'}
      className={cn('ba-liquid-icon overflow-visible', className)}
      style={{
        transitionDuration: `${duration}ms`,
      }}
      {...props}
    >
      <path className="ba-liquid-icon-line ba-liquid-icon-line-top" d="M4.5 7.5H19.5" />
      <path className="ba-liquid-icon-line ba-liquid-icon-line-middle" d="M4.5 12H19.5" />
      <path className="ba-liquid-icon-line ba-liquid-icon-line-bottom" d="M4.5 16.5H19.5" />
    </svg>
  );
}
