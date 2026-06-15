interface PageHeaderProps {
  eyebrow: string;
  title: string;
  sub?: string;
  /** When set, renders a back link above the title (used in project detail). */
  onBack?: () => void;
  backLabel?: string;
}

/** The editorial page header: optional back link, small uppercase eyebrow, large serif title, subtitle. */
export function PageHeader({ eyebrow, title, sub, onBack, backLabel }: PageHeaderProps) {
  return (
    <header className="page-head">
      {onBack && (
        <button className="back-link" onClick={onBack}>
          ‹ {backLabel ?? "Back"}
        </button>
      )}
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {sub && <p className="sub">{sub}</p>}
    </header>
  );
}
