"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { stageInfo, type WorkflowKind } from "@/lib/workflow";

export function StageTooltip({ kind, status }: { kind: WorkflowKind; status: string }) {
  const stage = stageInfo(kind, status);
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function show() {
    clearTimeout(hideTimer.current);
    setOpen(true);
  }
  function leave() {
    hideTimer.current = setTimeout(() => setOpen(false), 150);
  }
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!open || !button.current || !tooltip.current) return;
    const anchor = button.current.getBoundingClientRect();
    const size = tooltip.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - size.width - 8)),
      top:
        anchor.bottom + size.height + 8 < window.innerHeight
          ? anchor.bottom + 6
          : Math.max(8, anchor.top - size.height - 6)
    });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (event: PointerEvent) => {
      if (
        !button.current?.contains(event.target as Node) &&
        !tooltip.current?.contains(event.target as Node)
      )
        close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [open]);
  return (
    <span className="workflow-stage-help" onMouseEnter={show} onMouseLeave={leave}>
      <button
        ref={button}
        type="button"
        aria-label={`About ${stage.label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        ?
      </button>
      {open &&
        createPortal(
          <span
            ref={tooltip}
            id={id}
            role="tooltip"
            className="workflow-tooltip"
            style={position}
            onMouseEnter={show}
            onMouseLeave={leave}
          >
            {stage.description}
          </span>,
          document.body
        )}
    </span>
  );
}
