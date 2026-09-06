"use client";

import type { MouseEvent, ReactNode } from "react";

import { useTheme } from "../foundation/theme-provider";
import type { ThemePreference } from "../../lib/theme";

function SunIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="4.25"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 2.75v2M12 19.25v2M21.25 12h-2M4.75 12h-2M18.36 5.64l-1.42 1.42M7.06 16.94l-1.42 1.42M18.36 18.36l-1.42-1.42M7.06 7.06 5.64 5.64"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <rect
        height="12.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        width="17.5"
        x="3.25"
        y="4.25"
      />
      <path
        d="M9 20.75h6M12 16.75v4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M20.25 14.4A8.6 8.6 0 0 1 9.6 3.75a8.65 8.65 0 1 0 10.65 10.65Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

interface ThemeOption {
  icon: ReactNode;
  label: string;
  value: ThemePreference;
}

const themeOptions: readonly ThemeOption[] = [
  { icon: <SunIcon />, label: "Light", value: "light" },
  { icon: <MonitorIcon />, label: "System", value: "system" },
  { icon: <MoonIcon />, label: "Dark", value: "dark" },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  function handleSelect(
    event: MouseEvent<HTMLButtonElement>,
    value: ThemePreference,
  ) {
    if (value === preference) return;

    const rect = event.currentTarget.getBoundingClientRect();
    setPreference(value, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  return (
    <div
      aria-label="Color Theme"
      className="inline-flex shrink-0 items-center gap-xxs rounded-pill border border-border bg-surface-subtle p-xxs"
      role="radiogroup"
    >
      {themeOptions.map((option) => (
        <button
          aria-checked={preference === option.value}
          aria-label={`${option.label} Theme`}
          className="theme-option grid size-7 shrink-0 touch-manipulation place-items-center rounded-pill text-foreground-muted transition-[background-color,color,box-shadow] duration-200 ease-product hover:text-foreground-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          data-theme-option={option.value}
          key={option.value}
          onClick={(event) => handleSelect(event, option.value)}
          role="radio"
          title={`${option.label} Theme`}
          type="button"
        >
          {option.icon}
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
