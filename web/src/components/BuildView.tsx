import { type Kind, KIND_META, type Publication } from "../types";
import { KindDot } from "./KindDot";
import { PageHeader } from "./PageHeader";

interface BuildViewProps {
  signedIn: boolean;
  onSignIn: () => void;
  signingIn: boolean;
  publications: Publication[];
  onUnpublish: (p: Publication) => void;
}

/** The Build tab: everything you've published, grouped by kind, with unpublish. Gated on sign-in. */
export function BuildView({
  signedIn,
  onSignIn,
  signingIn,
  publications,
  onUnpublish,
}: BuildViewProps) {
  if (!signedIn) {
    return (
      <div className="empty">
        <div className="empty-mark">✶</div>
        <h2>Share your setup</h2>
        <p>
          Sign in to publish skills, rules, memory, commands and agents — and manage what you’ve shared.
        </p>
        <button className="btn btn-primary btn-lg" onClick={onSignIn} disabled={signingIn}>
          {signingIn ? "Signing in…" : "Sign in with Google"}
        </button>
      </div>
    );
  }

  if (publications.length === 0) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Your build"
          title="Nothing published yet"
          sub="Open the Global tab or a project and hit Publish on any item — it’ll show up here."
        />
      </div>
    );
  }

  // group publications by kind, in canonical order
  const byKind = new Map<Kind, Publication[]>();
  for (const k of Object.keys(KIND_META) as Kind[]) {
    const inKind = publications
      // registry kinds are lowercase ('skill'); KIND_META keys are capitalized ('Skill')
      .filter((p) => p.kind.toLowerCase() === k.toLowerCase())
      .sort((a, b) => a.name.localeCompare(b.name));
    if (inKind.length) byKind.set(k, inKind);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your build"
        title="Published"
        sub={`${publications.length} item${publications.length === 1 ? "" : "s"} shared from your setup.`}
      />
      {[...byKind.entries()].map(([kind, list]) => (
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
                  <span className="item-name">{p.name}</span>
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
      ))}
    </div>
  );
}
