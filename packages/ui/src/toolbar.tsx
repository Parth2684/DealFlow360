"use client";

import type { HTMLAttributes, KeyboardEvent } from "react";
import { classNames } from "./class-names.js";

export interface ToolbarProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label"
> {
  "aria-label": string;
  orientation?: "horizontal" | "vertical";
}

export function Toolbar({
  className,
  onKeyDown,
  orientation = "horizontal",
  ...props
}: ToolbarProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    const previousKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";

    if (
      event.key !== previousKey &&
      event.key !== nextKey &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

    if (controls.length === 0) {
      return;
    }

    const activeElement = event.currentTarget.ownerDocument.activeElement;
    const currentIndex = controls.findIndex(
      (control) => control === activeElement,
    );
    let nextIndex: number;

    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = controls.length - 1;
    } else {
      const direction = event.key === nextKey ? 1 : -1;
      const baseIndex =
        currentIndex >= 0 ? currentIndex : direction > 0 ? -1 : 0;
      nextIndex = (baseIndex + direction + controls.length) % controls.length;
    }

    event.preventDefault();
    controls[nextIndex]?.focus();
  }

  return (
    <div
      aria-orientation={orientation}
      className={classNames(
        "ui:flex ui:gap-xs",
        orientation === "horizontal"
          ? "ui:flex-wrap ui:items-center"
          : "ui:flex-col ui:items-stretch",
        className,
      )}
      onKeyDown={handleKeyDown}
      role="toolbar"
      {...props}
    />
  );
}

export interface ToolbarGroupProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export function ToolbarGroup({
  className,
  label,
  ...props
}: ToolbarGroupProps) {
  return (
    <div
      aria-label={label}
      className={classNames(
        "ui:flex ui:flex-wrap ui:items-center ui:gap-xs",
        className,
      )}
      role={label ? "group" : undefined}
      {...props}
    />
  );
}

export type ToolbarSpacerProps = HTMLAttributes<HTMLSpanElement>;

export function ToolbarSpacer({ className, ...props }: ToolbarSpacerProps) {
  return (
    <span
      aria-hidden="true"
      className={classNames("ui:min-w-xs ui:flex-1", className)}
      {...props}
    />
  );
}
