import { useEffect, useMemo, useRef, useState } from "react";

export interface AppDropdownOption {
  value: string;
  label: string;
}

interface AppDropdownProps {
  value: string;
  options: AppDropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  containerClassName?: string;
}

export default function AppDropdown({
  value,
  options,
  onChange,
  disabled = false,
  id,
  className = "",
  containerClassName = "",
}: AppDropdownProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && boxRef.current && !boxRef.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [value, disabled]);

  const resolvedOptions = useMemo(() => {
    if (!value || options.some((option) => option.value === value)) return options;
    return [{ value, label: value }, ...options];
  }, [options, value]);

  const selectedOption =
    resolvedOptions.find((option) => option.value === value) ?? resolvedOptions[0];

  return (
    <div className={`relative ${containerClassName}`.trim()} ref={boxRef}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`relative rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 ${
          className || "w-full"
        }`}
      >
        <span className="block truncate pr-6">{selectedOption?.label ?? ""}</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg ba-dropdown-pop">
          {resolvedOptions.map((option, idx) => {
            const selected = option.value === value;
            return (
              <button
                key={`${option.value}__${idx}`}
                type="button"
                onClick={() => onChange(option.value)}
                className={`w-full px-3 py-2 text-left text-sm first:rounded-t-xl last:rounded-b-xl ${
                  selected ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
