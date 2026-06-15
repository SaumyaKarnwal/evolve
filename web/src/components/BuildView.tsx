import { type Kind, KIND_META, type Publication, type UserInfo } from "../types";
import { KindDot } from "./KindDot";

interface BuildViewProps {
  user: UserInfo | null;
  signedIn: boolean;
  onSignIn: () => void;
  signingIn: boolean;
  publications: Publication[];
  onUnpublish: (p: Publication) => void;
}

const initialsOf = (s: string) =>
  s
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** The Profile tab: your identity + stats, then your published build (grouped by kind). */
export function BuildView({ user, signedIn, onSignIn, signingIn, publications, onUnpublish }: BuildViewProps) {
  if (!signedIn || !user) {
    return (
      <div className="empty">
        <div className="empty-mark">✶</div>
        <h2>Share your setup</h2>
        <p>Sign in to publish skills, rules, memory, commands and agents — and manage what you’ve shared.</p>
        <button className="btn btn-primary btn-lg" onClick={onSignIn} disabled={signingIn}>
          {signingIn ? "Signing in…" : "Sign in with Google"}
        </button>
      </div>
    );
  }

  const name = user.name ?? user.email ?? "You";
  const counts = new Map<Kind, number>();
  for (const p of publications) {
    const k = (p.kind.charAt(0).toUpperCase() + p.kind.slice(1)) as Kind;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const byKind = new Map<Kind, Publication[]>();
  for (const k of Object.keys(KIND_META) as Kind[]) {
    const inK = publications
      .filter((p) => (p.kind.charAt(0).toUpperCase() + p.kind.slice(1)) === k)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (inK.length) byKind.set(k, inK);
  }

  return (
    <div className="page">
      <header className="profile-head">
        <span className="avatar xl">{initialsOf(name)}</span>
        <div className="profile-id">
          <div className="eyebrow">Your build</div>
          <h1 className="profile-name serif">{name}</h1>
          {user.email && <div className="profile-email">{user.email}</div>}
        </div>
        <div className="profile-stats">
          <div className="stat">
            <span className="stat-n">{publications.length}</span>
            <span className="stat-l">published</span>
          </div>
          {[...counts.entries()].map(([k, n]) => (
            <div className="stat" key={k}>
              <span className="stat-n">{n}</span>
              <span className="stat-l">{KIND_META[k].plural.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </header>

      {publications.length === 0 ? (
        <p className="discover-empty">
          Nothing published yet — open My Claude and flip an item to <strong>Public</strong>.
        </p>
      ) : (
        [...byKind.entries()].map(([kind, list]) => (
          <section className="kind-section" key={kind}>
            <div className="kind-head">
              <KindDot kind={kind} />
              <h2>{KIND_META[kind].plural}</h2>
              <span className="count">{list.length}</span>
            </div>
            <div className="item-list">
              {list.map((p) => (
                <div className="card item-card" key={p.id}>
                  <div className="item-row">
                    <KindDot kind={kind} />
                    <span className="item-name mono">{p.name}</span>
                    <span className="item-preview" />
                    <span className="item-meta">
                      <span className="tag">v{p.latest_revision}</span>
                      <button className="pub-btn ghost" onClick={() => onUnpublish(p)}>
                        Unpublish
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
