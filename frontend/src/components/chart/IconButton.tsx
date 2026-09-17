import type { ReactNode } from "react";

type Props = {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  shortcut?: string;
};

export function IconButton({ label, active = false, onClick, children, shortcut }: Props) {
  const tooltip = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      className={active ? "icon-btn icon-btn-active" : "icon-btn"}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={tooltip}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
