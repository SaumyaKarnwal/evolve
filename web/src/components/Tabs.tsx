interface TabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}

/** A segmented control. Generic over the tab id type so callers keep their own union. */
export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <nav className="tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={"tab" + (t.id === active ? " active" : "")}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
