import type { ButtonHTMLAttributes, ReactNode } from "react";

const VARIANTS: Record<string, string> = {
  primary: "bg-primary hover:bg-primary-light text-white",
  danger: "bg-danger hover:bg-red-700 text-white",
  ghost: "bg-transparent hover:bg-surface-alt text-text border border-border",
  success: "bg-success hover:bg-green-700 text-white",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  loading?: boolean;
  icon?: ReactNode;
}

export default function Button({
  variant = "primary",
  loading = false,
  icon,
  children,
  disabled,
  className = "",
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${VARIANTS[variant] ?? VARIANTS.primary} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
