interface Props {
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ label, size = "md" }: Props) {
  const sizePx = size === "sm" ? 24 : size === "lg" ? 48 : 36;

  return (
    <div className="loading-spinner" role="status" aria-label={label || "Cargando"}>
      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 38 38"
        xmlns="http://www.w3.org/2000/svg"
        stroke="var(--accent, #14636a)"
      >
        <g fill="none" fillRule="evenodd">
          <g transform="translate(1 1)" strokeWidth="2">
            <circle strokeOpacity=".2" cx="18" cy="18" r="18" />
            <path d="M36 18c0-9.94-8.06-18-18-18" strokeWidth="3">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 18 18"
                to="360 18 18"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        </g>
      </svg>
      {label ? <p>{label}</p> : null}
    </div>
  );
}
