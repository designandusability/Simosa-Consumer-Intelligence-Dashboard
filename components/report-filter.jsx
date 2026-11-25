"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export default function ReportFilter({ label, value, options, onChange, placeholder }) {
  const id = useId();
  const container = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.key === value);

  useEffect(() => {
    if (!open) return;
    const root = container.current;
    (root.querySelector('[aria-pressed="true"]') || root.querySelector(".filter-menu button"))?.focus();
    function outside(event) {
      if (!root.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current.focus();
  }

  function navigate(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    const items = Array.from(event.currentTarget.querySelectorAll("button"));
    const index = items.indexOf(event.target);
    const next = { ArrowDown: (index + 1) % items.length, ArrowUp: (index - 1 + items.length) % items.length, Home: 0, End: items.length - 1 }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      items[next].focus();
    }
  }

  return <div className="report-filter" ref={container} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <span id={id + "-label"} className="filter-caption">{label}</span>
    <button type="button" className="filter-trigger" ref={trigger} disabled={!options.length}
      aria-expanded={open} aria-controls={open ? id : undefined} aria-labelledby={id + "-label " + id + "-value"}
      onClick={() => setOpen(!open)} onKeyDown={event => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); }
      }}>
      <span id={id + "-value"}>{selected?.label || placeholder}</span><ChevronDown size={15} />
    </button>
    {open && <div className="filter-menu" id={id} role="group" aria-labelledby={id + "-label"} onKeyDown={navigate}>
      {options.map(option => <button type="button" key={option.key} aria-pressed={option.key === value}
        onClick={() => { onChange(option.key); close(); }}>
        {option.label}{option.key === value && <Check size={14} />}
      </button>)}
    </div>}
  </div>;
}
