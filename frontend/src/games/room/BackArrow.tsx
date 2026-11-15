/** A left arrow for the back links. Drawn in the current text colour. */
export function BackArrow({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M13 8H3" />
      <path d="M7.5 3.5 3 8l4.5 4.5" />
    </svg>
  )
}
