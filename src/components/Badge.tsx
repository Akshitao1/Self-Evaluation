const VARIANTS: Record<string, string> = {
  success: "bg-success-light text-success",
  danger: "bg-danger-light text-danger",
  warning: "bg-warning-light text-warning",
  info: "bg-[#E8EAF6] text-primary",
  muted: "bg-surface-alt text-text-muted",
};

interface Props {
  variant?: keyof typeof VARIANTS;
  children: React.ReactNode;
}

export default function Badge({ variant = "muted", children }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium leading-tight ${VARIANTS[variant] ?? VARIANTS.muted}`}
    >
      {children}
    </span>
  );
}
