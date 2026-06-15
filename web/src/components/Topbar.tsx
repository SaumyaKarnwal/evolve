import type { ReactNode } from "react";

interface TopbarProps {
  count: number | null;
  loading: boolean;
  synced: boolean;
  onSync: () => void;
  /** Centered slot — e.g. the Global/Projects/Build tabs. */
  children?: ReactNode;
  /** Right-side slot for the auth control. */
  authArea?: ReactNode;
}

/** Global bar: wordmark (left), a centered slot, auth + item count + Re-sync (right). */
export function Topbar({ count, loading, synced, onSync, children, authArea }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="wordmark">
          Evolve<span className="dot">.</span>
        </span>
      </div>
      {children && <div className="topbar-center">{children}</div>}
      <div className="topbar-actions">
        {authArea}
        {count !== null && <span className="topbar-count">{count} items</span>}
        <button className="btn btn-primary" onClick={onSync} disabled={loading}>
          {loading ? "Scanning…" : synced ? "Re-sync" : "Sync"}
        </button>
      </div>
    </header>
  );
}
