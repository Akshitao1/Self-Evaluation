import type { ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export default function Card({ title, children, className = "", action }: Props) {
  return (
    <div className={`bg-surface rounded-md shadow-sm border border-border-light ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light">
          <h3 className="font-semibold text-[15px] text-text">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
