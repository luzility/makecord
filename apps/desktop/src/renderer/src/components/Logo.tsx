import { useId } from "react";

export function Logo({ size = 20 }: { size?: number }) {
  const id = `mk-logo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill={`url(#${id})`} />
      <path
        d="M26.6023 30.3804C27.4263 27.2756 30.2364 25.114 33.4487 25.114C36.3943 25.114 39.0325 26.9369 40.0744 29.6921L49.1854 53.7872C49.2348 53.918 49.3601 54.0046 49.5 54.0046C49.6399 54.0046 49.7652 53.918 49.8146 53.7872L58.8719 29.8343C59.946 26.9935 62.6662 25.114 65.7033 25.114C68.8627 25.114 71.664 27.1455 72.6455 30.1486L77.2523 44.2437C78.1809 47.0851 76.0636 50.0046 73.0743 50.0046C71.7609 50.0046 70.5163 49.4172 69.6813 48.4034L62.9494 40.2288C62.8959 40.1638 62.8161 40.1262 62.7319 40.1262C62.6139 40.1262 62.5084 40.1996 62.4675 40.3103L53.2294 65.3076C52.6527 66.8679 51.1653 67.904 49.5018 67.904C47.8366 67.904 46.3479 66.8657 45.7726 65.3031L36.5286 40.1954C36.49 40.0907 36.3903 40.0212 36.2787 40.0212C36.1891 40.0212 36.1055 40.0663 36.0563 40.1412L30.8104 48.1208C29.9925 49.3649 28.6035 50.114 27.1146 50.114C24.2109 50.114 22.0949 47.3632 22.8398 44.5566L26.6023 30.3804Z"
        fill="white"
      />
      <circle cx="32" cy="68" r="7" fill="white" />
      <circle cx="67" cy="68" r="7" fill="white" />
      <defs>
        <radialGradient
          id={id}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(50) rotate(90) scale(100)"
        >
          <stop stopColor="#7200D5" />
          <stop offset="1" stopColor="#006F6F" />
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
