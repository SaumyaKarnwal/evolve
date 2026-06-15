import { useState } from "react";
import type { Kind, PublicItem } from "../types";
import { adoptItem } from "../dataSource";
import { preview } from "../lib/grouping";
import { KindDot } from "./KindDot";
import { PageHeader } from "./PageHeader";

/** Registry kinds are lowercase ("skill"); KindDot wants the capitalized Kind. */
const toKind = (k: string): Kind => (k.charAt(0).toUpperCase() + k.slice(1)) as Kind;

interface DiscoverViewProps {
  items: PublicItem[] | null;
  loading: boolean;
  error: string | null;
}

/** The Discover tab: everyone's public publications, grouped by author, each expandable to read. */
export function DiscoverView({ items, loading, error }: DiscoverViewProps) {
  if (error) return <div className="error">Discover: {error}</div>;
  if (loading && !items) {
    return (
      <div className="loading">
        <span className="spinner" /> Loading what others have shared…
      </div>
    );
  }
  if (!items) return null;

  if (items.length === 0) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Discover"
          title="Nothing shared yet"
          sub="When people publish skills, rules, memory, commands or agents, they show up here to browse."
        />
      </div>
    );
  }

  const byAuthor = new Map<string, PublicItem[]>();
  for (const it of items) {
    const author = it.owner_name ?? "Unknown";
    (byAuthor.get(author) ?? byAuthor.set(author, []).get(author)!).push(it);
  }
  const authors = [...byAuthor.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Discover"
        title="What others are sharing"
        sub={`${items.length} item${items.length === 1 ? "" : "s"} from ${authors.length} ${
          authors.length === 1 ? "person" : "people"
        }.`}
      />
      {authors.map(([author, list]) => (
        <section className="author-group" key={author}>
          <div className="author-head">
            <span className="avatar">{author.charAt(0).toUpperCase()}</span>
            <h2>{author}</h2>
            <span className="count">{list.length}</span>
          </div>
          <div className="item-list">
            {list
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((it) => (
                <PublicCard key={it.id} item={it} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type AdoptStatus = "idle" | "working" | "done" | "exists" | "unsupported" | "error";

function PublicCard({ item }: { item: PublicItem }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AdoptStatus>("idle");
  const [msg, setMsg] = useState("");

  const adopt = async (overwrite: boolean) => {
    setStatus("working");
    try {
      const outcome = await adoptItem(item, overwrite);
      setStatus(
        outcome === "Created" || outcome === "Overwritten"
          ? "done"
          : outcome === "Exists"
            ? "exists"
            : "unsupported",
      );
    } catch (e) {
      setStatus("error");
      setMsg(String(e));
    }
  };

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className={`card item-card${open ? " open" : ""}`}>
      <div className="item-row" onClick={() => setOpen((o) => !o)}>
        <KindDot kind={toKind(item.kind)} />
        <span className="item-name">{item.name}</span>
        {!open && <span className="item-preview">{preview(item.body)}</span>}
        <span className="item-meta">
          <span className="tag">v{item.latest_revision}</span>
          {status === "idle" && (
            <button className="pub-btn" onClick={stop(() => adopt(false))}>
              Adopt
            </button>
          )}
          {status === "working" && <span className="pub-tag busy">adopting…</span>}
          {status === "done" && <span className="pub-tag published">Adopted ✓</span>}
          {status === "exists" && (
            <button
              className="pub-btn ghost"
              title="Already in your ~/.claude — replace it"
              onClick={stop(() => adopt(true))}
            >
              Replace?
            </button>
          )}
          {status === "unsupported" && (
            <span className="pub-tag busy" title="Memory, or a rule that needs a manual merge">
              can’t adopt
            </span>
          )}
          {status === "error" && (
            <span className="pub-tag busy" title={msg}>
              failed
            </span>
          )}
          <span className="chevron">▶</span>
        </span>
      </div>
      {open && (
        <div className="item-body">
          <pre>{item.body}</pre>
        </div>
      )}
    </div>
  );
}
