interface ConditionsIconProps {
  conditions: string;
  size?: number;
  className?: string;
}

export function ConditionsIcon({
  conditions,
  size = 16,
  className = "",
}: ConditionsIconProps) {
  const lower = conditions.toLowerCase();

  // Snow conditions
  if (lower.includes("heavy snow")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
      >
        <circle cx="6" cy="6" r="2" fill="#4A9BD9" />
        <circle cx="12" cy="4" r="2" fill="#4A9BD9" />
        <circle cx="18" cy="7" r="2" fill="#4A9BD9" />
        <circle cx="4" cy="13" r="2" fill="#4A9BD9" />
        <circle cx="10" cy="11" r="2" fill="#4A9BD9" />
        <circle cx="16" cy="14" r="2" fill="#4A9BD9" />
        <circle cx="8" cy="19" r="2" fill="#4A9BD9" />
        <circle cx="14" cy="20" r="2" fill="#4A9BD9" />
        <circle cx="20" cy="18" r="2" fill="#4A9BD9" />
      </svg>
    );
  }

  if (lower.includes("snow") || lower.includes("flurries")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
      >
        <circle cx="7" cy="8" r="2" fill="#4A9BD9" />
        <circle cx="14" cy="6" r="2" fill="#4A9BD9" />
        <circle cx="6" cy="16" r="2" fill="#4A9BD9" />
        <circle cx="16" cy="15" r="2" fill="#4A9BD9" />
        <circle cx="11" cy="19" r="2" fill="#4A9BD9" />
      </svg>
    );
  }

  // Rain
  if (lower.includes("rain") || lower.includes("drizzle")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
      >
        <path
          d="M6 14l-1 4M10 14l-1 4M14 14l-1 4M18 14l-1 4"
          stroke="#4A9BD9"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M4 10a4 4 0 014-4 5 5 0 019.9 1A3 3 0 0120 10H4z"
          fill="#8B9DC3"
          opacity="0.5"
        />
      </svg>
    );
  }

  // Overcast / mostly cloudy
  if (lower.includes("overcast") || lower.includes("mostly cloudy")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
      >
        <path
          d="M4 15a4 4 0 014-4h0a5 5 0 019.9 1A3 3 0 0120 15H4z"
          fill="#8B9DC3"
          opacity="0.6"
        />
      </svg>
    );
  }

  // Partly cloudy
  if (lower.includes("partly cloudy") || lower.includes("mainly clear")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
      >
        <circle cx="12" cy="8" r="4" fill="#FF6B35" opacity="0.8" />
        <path
          d="M6 18a3 3 0 013-3h0a4 4 0 017.9 1A2.5 2.5 0 0118 18H6z"
          fill="#8B9DC3"
          opacity="0.5"
        />
      </svg>
    );
  }

  // Clear
  if (lower.includes("clear") || lower === "sunny") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
      >
        <circle cx="12" cy="12" r="5" fill="#FF6B35" opacity="0.9" />
        <path
          d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
          stroke="#FF6B35"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    );
  }

  // Fog
  if (lower.includes("fog")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
      >
        <path
          d="M4 8h16M4 12h16M4 16h12"
          stroke="#8B9DC3"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    );
  }

  // Default
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <circle cx="12" cy="12" r="3" fill="#8B9DC3" opacity="0.5" />
    </svg>
  );
}
