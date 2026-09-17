type IconProps = {
  size?: number;
};

export function IconCandles({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M4 3h2v2h1v8H5V5H4zm6 2h2v2h1v6H9V7h1z" />
    </svg>
  );
}

export function IconBar({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M3 4h1v8H3zm2 3h6v1H5zm7-3h1v8h-1z" />
    </svg>
  );
}

export function IconLine({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.6" d="M2 12 6 7l3 3 5-7" />
    </svg>
  );
}

export function IconArea({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" opacity="0.35" d="M2 12 6 7l3 3 5-7v9H2z" />
      <path fill="none" stroke="currentColor" strokeWidth="1.4" d="M2 12 6 7l3 3 5-7" />
    </svg>
  );
}

export function IconCalendar({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        d="M3 5h10v8H3zm0 3h10M6 3v3m4-3v3"
      />
    </svg>
  );
}

export function IconLatest({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.4" d="M3 8h8m0 0-3-3m3 3-3 3M13 4v8" />
    </svg>
  );
}

export function IconReset({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.4" d="M4 8a4 4 0 1 0 1-2.7M4 3v3h3" />
    </svg>
  );
}

export function IconAutoScale({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.4" d="M3 13V3m0 10h10M5 10l3-4 2 2 3-5" />
    </svg>
  );
}

export function IconLogScale({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.4" d="M3 13V3m0 10h10M5 11c2-1 3-5 7-8" />
    </svg>
  );
}

export function IconSettings({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        d="M8 10.2A2.2 2.2 0 1 0 8 5.8a2.2 2.2 0 0 0 0 4.4zM8 2.5l.7 1.7 1.8-.4 1 1.6-1.3 1.3.4 1.8-1.7.7-.7 1.7-1.8-.4-1-1.6 1.3-1.3-.4-1.8L8 2.5z"
      />
    </svg>
  );
}

export function IconFullscreen({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.4" d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" />
    </svg>
  );
}

export function IconIndicators({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.4" d="M2 12 5 8l3 2 6-7" />
      <path fill="none" stroke="currentColor" strokeWidth="1.4" d="M2 10h12" opacity="0.45" />
    </svg>
  );
}

export function IconInspector({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.4" d="M3 3h10v10H3zM6 6h4M6 8.5h4M6 11h2" />
    </svg>
  );
}

export function IconClose({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.4" d="m4 4 8 8M12 4 4 12" />
    </svg>
  );
}
