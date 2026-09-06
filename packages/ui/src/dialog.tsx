"use client";

import { XIcon } from "@phosphor-icons/react/X";
import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { classNames } from "./class-names.js";
import { IconButton } from "./button.js";
import { ICON_WEIGHT } from "./icons.js";

export type DialogSize = "compact" | "default" | "wide";

export interface DialogProps {
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  description?: ReactNode;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  size?: DialogSize;
  title: ReactNode;
}

const sizeClassNames: Record<DialogSize, string> = {
  compact: "ui:max-w-[28rem]",
  default: "ui:max-w-[36rem]",
  wide: "ui:max-w-4xl",
};

function useModalDialog(open: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [open]);

  return dialogRef;
}

interface ModalContentsProps {
  children: ReactNode;
  closeLabel: string;
  description?: ReactNode;
  descriptionId?: string;
  footer?: ReactNode;
  onClose: () => void;
  title: ReactNode;
  titleId: string;
}

function ModalContents({
  children,
  closeLabel,
  description,
  descriptionId,
  footer,
  onClose,
  title,
  titleId,
}: ModalContentsProps) {
  return (
    <>
      <header className="ui:flex ui:items-start ui:justify-between ui:gap-md ui:border-b ui:border-border ui:px-md ui:py-sm">
        <div className="ui:grid ui:gap-xxs">
          <h2
            className="ui:m-0 ui:scroll-mt-24 ui:text-balance ui:font-sans ui:text-title ui:font-semibold ui:text-foreground-strong"
            id={titleId}
          >
            {title}
          </h2>
          {description ? (
            <p
              className="ui:m-0 ui:max-w-reading ui:text-pretty ui:font-sans ui:text-body-sm ui:text-foreground-muted"
              id={descriptionId}
            >
              {description}
            </p>
          ) : null}
        </div>
        <IconButton aria-label={closeLabel} onClick={onClose} size="compact">
          <XIcon
            aria-hidden="true"
            className="ui:size-md"
            weight={ICON_WEIGHT}
          />
        </IconButton>
      </header>
      <div className="ui:min-h-0 ui:flex-1 ui:overflow-y-auto ui:overscroll-contain ui:px-md ui:py-sm">
        {children}
      </div>
      {footer ? (
        <footer className="ui:flex ui:flex-wrap ui:justify-end ui:gap-xs ui:border-t ui:border-border ui:bg-surface-subtle ui:px-md ui:py-sm">
          {footer}
        </footer>
      ) : null}
    </>
  );
}

export function Dialog({
  children,
  className,
  closeLabel = "Close Dialog",
  description,
  footer,
  onOpenChange,
  open,
  size = "default",
  title,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useModalDialog(open);

  function requestClose() {
    onOpenChange(false);
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  }

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className={classNames(
        "ui:m-auto ui:max-h-dvh ui:w-full ui:overflow-hidden ui:rounded-dialog ui:border ui:border-border ui:bg-surface ui:p-0 ui:text-foreground ui:shadow-overlay ui:backdrop:bg-scrim ui:backdrop:backdrop-blur-[2px] ui:open:flex ui:open:flex-col ui:open:animate-dialog-in ui:motion-reduce:animate-none",
        sizeClassNames[size],
        className,
      )}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={() => {
        if (open) requestClose();
      }}
      onClick={handleBackdropClick}
      ref={dialogRef}
    >
      <ModalContents
        closeLabel={closeLabel}
        description={description}
        descriptionId={descriptionId}
        footer={footer}
        onClose={requestClose}
        title={title}
        titleId={titleId}
      >
        {children}
      </ModalContents>
    </dialog>
  );
}

export type DrawerSide = "left" | "right";

export interface DrawerProps extends Omit<DialogProps, "size"> {
  side?: DrawerSide;
}

export function Drawer({
  children,
  className,
  closeLabel = "Close Drawer",
  description,
  footer,
  onOpenChange,
  open,
  side = "right",
  title,
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useModalDialog(open);

  function requestClose() {
    onOpenChange(false);
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  }

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className={classNames(
        "ui:fixed ui:inset-y-0 ui:m-0 ui:h-dvh ui:w-full ui:max-w-[28rem] ui:overflow-hidden ui:border-border ui:bg-surface ui:p-0 ui:text-foreground ui:shadow-overlay ui:backdrop:bg-scrim ui:backdrop:backdrop-blur-[2px] ui:open:flex ui:open:flex-col ui:motion-reduce:animate-none",
        side === "right"
          ? "ui:right-0 ui:left-auto ui:rounded-l-dialog ui:border-l ui:open:animate-drawer-in-right"
          : "ui:left-0 ui:right-auto ui:rounded-r-dialog ui:border-r ui:open:animate-drawer-in-left",
        className,
      )}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={() => {
        if (open) requestClose();
      }}
      onClick={handleBackdropClick}
      ref={dialogRef}
    >
      <ModalContents
        closeLabel={closeLabel}
        description={description}
        descriptionId={descriptionId}
        footer={footer}
        onClose={requestClose}
        title={title}
        titleId={titleId}
      >
        {children}
      </ModalContents>
    </dialog>
  );
}
