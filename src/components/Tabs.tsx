interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export default function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-surface-alt p-1 rounded-md border border-border-light">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              isActive
                ? "bg-surface text-primary shadow-sm"
                : "text-text-muted hover:text-text hover:bg-surface/50"
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`ml-1.5 text-xs ${isActive ? "text-secondary" : "text-text-light"}`}>
                {tab.count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
