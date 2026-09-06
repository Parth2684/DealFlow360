"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { classNames } from "./class-names.js";

export interface TabItem {
  content: ReactNode;
  disabled?: boolean;
  label: ReactNode;
  value: string;
}

export interface TabsProps {
  className?: string;
  items: readonly TabItem[];
  label: string;
  onValueChange: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  value: string;
}

function getEnabledIndex(
  items: readonly TabItem[],
  startIndex: number,
  step: 1 | -1,
): number | null {
  if (items.length === 0) {
    return null;
  }

  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (startIndex + step * offset + items.length) % items.length;
    const item = items[index];

    if (item && !item.disabled) {
      return index;
    }
  }

  return null;
}

export function Tabs({
  className,
  items,
  label,
  onValueChange,
  orientation = "horizontal",
  value,
}: TabsProps) {
  const instanceId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = items.findIndex(
    (item) => item.value === value && !item.disabled,
  );
  const fallbackIndex = items.findIndex((item) => !item.disabled);

  function activate(index: number) {
    const item = items[index];

    if (!item || item.disabled) {
      return;
    }

    onValueChange(item.value);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const previousKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";

    if (event.key === "Home") {
      event.preventDefault();
      const firstIndex = items.findIndex((item) => !item.disabled);
      if (firstIndex >= 0) activate(firstIndex);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const reversedIndex = [...items]
        .reverse()
        .findIndex((item) => !item.disabled);
      if (reversedIndex >= 0) activate(items.length - reversedIndex - 1);
      return;
    }

    if (event.key !== previousKey && event.key !== nextKey) {
      return;
    }

    event.preventDefault();
    const targetIndex = getEnabledIndex(
      items,
      index,
      event.key === nextKey ? 1 : -1,
    );

    if (targetIndex !== null) activate(targetIndex);
  }

  return (
    <div
      className={classNames(
        orientation === "vertical"
          ? "ui:grid ui:gap-md ui:md:grid-cols-4"
          : "ui:grid ui:gap-md",
        className,
      )}
    >
      <div
        aria-label={label}
        aria-orientation={orientation}
        className={classNames(
          orientation === "horizontal"
            ? "ui:flex ui:overflow-x-auto ui:border-b ui:border-border"
            : "ui:flex ui:flex-col ui:border-r ui:border-border ui:md:col-span-1",
        )}
        role="tablist"
      >
        {items.map((item, index) => {
          const selected = index === activeIndex;
          const tabId = `${instanceId}-tab-${index}`;
          const panelId = `${instanceId}-panel-${index}`;

          return (
            <button
              aria-controls={panelId}
              aria-selected={selected}
              className={classNames(
                "ui:min-h-touch ui:shrink-0 ui:touch-manipulation ui:border-transparent ui:px-sm ui:py-xs ui:text-left ui:font-sans ui:text-body-sm ui:font-semibold ui:transition-[color,border-color,background-color] ui:duration-150 ui:ease-product ui:focus-visible:outline-2 ui:focus-visible:outline-offset-2 ui:focus-visible:outline-focus ui:disabled:cursor-not-allowed ui:disabled:border-transparent ui:disabled:text-foreground-disabled",
                orientation === "horizontal"
                  ? "ui:-mb-px ui:border-b-2"
                  : "ui:-mr-px ui:border-r-2 ui:rounded-l-control",
                selected
                  ? "ui:border-brand ui:text-brand"
                  : "ui:text-foreground-muted ui:hover:border-border-strong ui:hover:bg-surface-subtle ui:hover:text-foreground-strong",
              )}
              disabled={item.disabled}
              id={tabId}
              key={item.value}
              onClick={() => activate(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              tabIndex={
                selected || (activeIndex < 0 && index === fallbackIndex)
                  ? 0
                  : -1
              }
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        className={orientation === "vertical" ? "ui:md:col-span-3" : undefined}
      >
        {items.map((item, index) => {
          const selected = index === activeIndex;

          return (
            <div
              aria-labelledby={`${instanceId}-tab-${index}`}
              hidden={!selected}
              id={`${instanceId}-panel-${index}`}
              key={item.value}
              role="tabpanel"
              tabIndex={0}
            >
              {item.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
