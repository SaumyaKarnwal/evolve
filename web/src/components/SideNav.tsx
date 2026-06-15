import type { ReactNode } from "react";
import type { UserInfo } from "../types";

interface NavItem<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
  badge?: number;
}

interface SideNavProps<T extends string> {
  items: NavItem<T>[];
  active: T;
  onChange: (id: T) => void;
  user: UserInfo | null;
  onSignOut: () => void;
  count: number | null;
}

/** The mock's left rail: wordmark, nav items (icon + label), and the account at the bottom. */
export function SideNav<T extends string>({
  items,
  active,
  onChange,
  user,
  onSignOut,
  count,
}: SideNavProps<T>) {
  return (
    <nav className="sidenav">
      <div className="sidenav-brand wordmark">
        Evolve<span className="dot">.</span>
      </div>
      <div className="sidenav-items">
        {items.map((it) => (
          <button
            key={it.id}
            className={"nav-item" + (it.id === active ? " active" : "")}
            onClick={() => onChange(it.id)}
          >
            <span className="nav-icon">{it.icon}</span>
            {it.label}
            {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
          </button>
        ))}
      </div>
      <div className="sidenav-foot">
        {count !== null && <div className="sidenav-count">{count} items synced</div>}
        {user && (
          <button className="sidenav-user" onClick={onSignOut} title="Sign out">
            <span className="avatar">
              {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
            </span>
            <span className="sidenav-user-name">{user.name ?? user.email}</span>
          </button>
        )}
      </div>
    </nav>
  );
}

/** Small stroke icons (16px) for the rail. */
export const NAV_ICONS: Record<string, ReactNode> = {
  myclaude: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" /> <path d="M3 13l9 5 9-5" />
    </svg>
  ),
  projects: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  ),
  discover: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" /> <path d="m15 9-2 4-4 2 2-4 4-2Z" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" /> <path d="M3 20a6 6 0 0 1 12 0" /> <path d="M16 6a3 3 0 0 1 0 6m5 8a6 6 0 0 0-4-5.7" />
    </svg>
  ),
  build: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 19V5" /> <path d="m6 11 6-6 6 6" />
    </svg>
  ),
};
