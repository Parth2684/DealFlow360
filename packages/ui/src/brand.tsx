import type { HTMLAttributes } from "react";
import { classNames } from "./class-names.js";
import Image from "next/image";

export interface DealFlowBrandProps extends HTMLAttributes<HTMLSpanElement> {
  compact?: boolean;
  label?: string;
  img_src?: string; // Kept optional as requested
}

export function DealFlowBrand({
  className,
  compact = false,
  img_src,
  label = "DealFlow360",
  ...props
}: DealFlowBrandProps) {
  return (
    <span
      className={classNames(
        "ui:inline-flex ui:items-center ui:gap-xs ui:font-sans ui:text-title ui:font-semibold ui:text-foreground-strong",
        className,
      )}
      translate="no"
      {...props}
    >
      <span
        aria-hidden="true"
        className="ui:grid ui:size-touch ui:shrink-0 ui:place-items-center"
      >
        {img_src ? (
          <Image
            src={img_src}
            alt={`${label} logo`}
            width={24}
            height={24}
            className="ui:size-full ui:object-contain"
          />
        ) : (
          <span>{label.charAt(0)}</span>
        )}
      </span>
      {compact ? (
        <span className="ui:sr-only">{label}</span>
      ) : (
        <span>{label}</span>
      )}
    </span>
  );
}
