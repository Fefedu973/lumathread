"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@site/components/ui/collapsible";
import { Label } from "@site/components/ui/label";
import { Slider } from "@site/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./lab-select";
import { cn } from "@site/lib/utils";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function decimalsFor(step: number) {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  if (step >= 0.01) return 2;
  return 3;
}

function sliderValue(value: number | readonly number[], fallback: number) {
  const first = Array.isArray(value) ? value[0] : value;
  return Number.isFinite(first) ? (first as number) : fallback;
}

/**
 * A labelled shadcn slider paired with a keyboard-editable numeric field, so
 * every parameter can be dragged coarsely or typed precisely. The name is kept
 * for the large existing call surface.
 */
export function NumberSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  const decimals = decimalsFor(step);
  const safeValue = Number.isFinite(value) ? value : min;
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) {
      const snapped = Math.round(parsed / step) * step;
      onChange(clamp(Number(snapped.toFixed(6)), min, max));
    }
    setDraft(null);
  };

  return (
    <div
      className="group/field space-y-1.5 transition-opacity data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40"
      data-disabled={disabled}
    >
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] font-medium text-muted-foreground group-hover/field:text-foreground">
          {label}
        </Label>
        <div className="flex items-center gap-0.5">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${label} value`}
            disabled={disabled}
            value={draft ?? safeValue.toFixed(decimals)}
            onFocus={(event) => {
              setDraft(safeValue.toFixed(decimals));
              event.currentTarget.select();
            }}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                setDraft(null);
                event.currentTarget.blur();
              }
            }}
            className="w-14 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right font-mono text-[11px] text-foreground tabular-nums transition-colors hover:border-border focus:border-ring focus:bg-background focus:outline-none"
          />
          {suffix ? (
            <span className="w-4 shrink-0 font-mono text-[10px] text-muted-foreground">
              {suffix}
            </span>
          ) : null}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[safeValue]}
        disabled={disabled}
        aria-label={label}
        onValueChange={(next) => onChange(sliderValue(next, safeValue))}
      />
    </div>
  );
}

/** Small heading used at the top of each control group. */
export function SectionHeading({
  children,
  detail,
}: {
  children: string;
  detail?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
        {children}
      </h3>
      {detail ? (
        <span className="truncate text-[10px] text-muted-foreground">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A titled container that groups related controls. Replaces the ad-hoc
 * `border-l pl-3` blocks with a consistent card. Set `collapsible` to fold
 * advanced parameters away until they are needed.
 */
export function ControlGroup({
  title,
  detail,
  children,
  className,
  action,
  muted = false,
  collapsible = false,
  defaultOpen = true,
  disabled = false,
}: {
  title?: string;
  detail?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  muted?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
}) {
  const container = cn(
    "rounded-xl border border-border/70",
    muted ? "bg-muted/20" : "bg-card/40",
    disabled && "pointer-events-none opacity-50",
    className,
  );

  const heading = title ? (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="text-[11px] font-semibold tracking-wide uppercase">
        {title}
      </span>
      {detail ? (
        <span className="truncate text-[10px] font-normal text-muted-foreground">
          {detail}
        </span>
      ) : null}
    </div>
  ) : null;

  const body = <div className="space-y-2.5 px-3 pb-3">{children}</div>;

  if (!collapsible || !title) {
    return (
      <div className={container}>
        {title ? (
          <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
            <div className="min-w-0 flex-1 text-foreground">{heading}</div>
            {action}
          </div>
        ) : null}
        <div className={cn(!title && "pt-3")}>{body}</div>
      </div>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className={container}>
      {/* Symmetric padding on the trigger keeps the collapsed header centred. */}
      <div className="flex items-center justify-between gap-2 px-3">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="group/trigger flex min-w-0 flex-1 items-center gap-1.5 py-2.5 text-left text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          }
        >
          <ChevronRight
            aria-hidden
            className="size-3 shrink-0 text-muted-foreground transition-transform group-aria-expanded/trigger:rotate-90"
          />
          {heading}
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent>{body}</CollapsibleContent>
    </Collapsible>
  );
}

/** A label + right-aligned control on one baseline-aligned row. */
export function FieldRow({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <Label
        htmlFor={htmlFor}
        className="min-w-0 text-[11px] font-medium text-muted-foreground"
      >
        {label}
      </Label>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

/** A boolean toggle drawn as a switch, with the label as the click target. */
export function SwitchField({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label
        htmlFor={id}
        className={cn(
          "flex min-w-0 flex-col gap-0.5 text-[11px] font-medium select-none",
          disabled ? "text-muted-foreground/50" : "text-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        {hint ? (
          <span className="text-[10px] font-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === "string" ? label : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-3.5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A dropdown built from an option list. The option labels are passed to Base
 * UI as `items` so the trigger shows the selected label rather than its raw
 * value.
 */
export function SelectField<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  disabled = false,
  className,
}: {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const items = useMemo(
    () =>
      Object.fromEntries(options.map((option) => [option.value, option.label])),
    [options],
  );

  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => {
        if (options.some((option) => option.value === next)) {
          onChange(next as T);
        }
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn("w-full", className)}
      >
        <SelectValue placeholder={placeholder ?? ariaLabel} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

/** A compact single-select segmented control for small enums. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  columns,
  ariaLabel,
}: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  columns?: number;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "grid gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5",
        disabled && "pointer-events-none opacity-40",
      )}
      style={{
        gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A colour swatch that opens the native picker, with the hex shown. */
export function ColorField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(null);
  }, [value]);

  return (
    <FieldRow label={label}>
      <input
        type="text"
        aria-label={`${label} hex`}
        disabled={disabled}
        value={text ?? value}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => {
          const next = event.target.value.trim();
          if (/^#?[0-9a-fA-F]{6}$/.test(next)) {
            onChange(next.startsWith("#") ? next : `#${next}`);
          }
          setText(null);
        }}
        className="w-16 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right font-mono text-[11px] text-muted-foreground uppercase transition-colors hover:border-border focus:border-ring focus:bg-background focus:text-foreground focus:outline-none"
      />
      <label
        className={cn(
          "relative size-6 shrink-0 overflow-hidden rounded-md border border-border shadow-sm",
          disabled ? "opacity-40" : "cursor-pointer",
        )}
        style={{ backgroundColor: value }}
        aria-label={label}
      >
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </FieldRow>
  );
}
