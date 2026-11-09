import { useId } from "react";

export function Logo({ size = 20 }: { size?: number }) {
  const id = `mk-logo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill={`url(#${id})`} />
      <path
        d="M32 66V31L50 62.5L68 31V66"
        stroke="white"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="66" r="7" fill="white" />
      <circle cx="68" cy="66" r="7" fill="white" />
      <defs>
        <radialGradient
          id={id}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(50) rotate(90) scale(100)"
        >
          <stop stopColor="#0024D5" />
          <stop offset="1" stopColor="#00136F" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function Led({ on, className = "" }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 rounded-full transition-[background-color,box-shadow] duration-300 ease-out ${
        on ? "bg-signal shadow-[0_0_0_2px_rgb(245_165_36/0.18)]" : "bg-faint/40"
      } ${className}`}
    />
  );
}
