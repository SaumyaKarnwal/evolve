import type { ReactNode } from "react";

interface TopbarProps {
  count: number | null;
  /** Centered slot — e.g. the Global/Projects/Build tabs. */
  children?: ReactNode;
  /** Right-side slot for the auth control. */
  authArea?: ReactNode;
}

/** Global bar: wordmark (left), a centered slot (tabs), item count + auth (right). */
export function Topbar({ count, children, authArea }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="wordmark">
          Evolve<span className="dot">.</span>
        </span>
      </div>
      {children && <div className="topbar-center">{children}</div>}
      <div className="topbar-actions">
        {count !== null && <span className="topbar-count">{count} items</span>}
        {authArea}
      </div>
    </header>
  );
}
