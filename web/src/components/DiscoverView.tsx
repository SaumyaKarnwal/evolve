import { useMemo, useState } from "react";
import { type Kind, KIND_META, type PublicItem } from "../types";
import { adoptItem, type InstallOutcome } from "../dataSource";
import { preview } from "../lib/grouping";
import { KindTile } from "./KindTile";
import { Filters } from "./Filters";

/** Registry kinds are lowercase ("skill"); UI types are capitalized ("Skill"). */
const toKind = (k: string): Kind => (k.charAt(0).toUpperCase() + k.slice(1)) as Kind;

type AdoptStatus = "idle" | "working" | "done" | "exists" | "unsupported" | "error";

interface DestOption {
  label: string;
  path: string | null; // null = global ~/.claude
}

interface DiscoverViewProps {
  items: PublicItem[] | null;
  loading: boolean;
  error: string | null;
  /** Adopt destinations: Global + resolved projects. */
  destinations: DestOption[];
}

export function DiscoverView({ items, loading, error, destinations }: DiscoverViewProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [destPath, setDestPath] = useState<string | null>(null); // null = Global
  const [detail, setDetail] = useState<PublicItem | null>(null);

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { Skill: 0, Rule: 0, Memory: 0, Command: 0, Agent: 0 };
    for (const it of items ?? []) c[toKind(it.kind)]++;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? [])
      .filter(
        (i) =>
          (!kind || toKind(i.kind) === kind) &&
          (!q || i.name.toLowerCase().includes(q) || i.body.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, kind, query]);

  const adopt = (item: PublicItem, overwrite: boolean) => adoptItem(item, overwrite, destPath);

  if (error) return <div className="error">Discover: {error}</div>;
  if (loading && !items) {
    return (
      <div className="loading">
        <span className="spinner" /> Loading the library…
      </div>
    );
  }
  if (!items) return null;

  return (
    <div className="discover">
      <header className="discover-head">
        <div>
          <div className="eyebrow">The library</div>
          <h1>Discover</h1>
        </div>
        <label className="dest-picker">
          Adopt into
          <select value={destPath ?? ""} onChange={(e) => setDestPath(e.target.value || null)}>
            {destinations.map((d) => (
              <option key={d.label} value={d.path ?? ""}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {items.length === 0 ? (
        <p className="discover-empty">
          Nothing shared yet — when people publish, their skills, rules, commands and agents show up
          here to browse and adopt.
        </p>
      ) : (
        <>
          <Filters
            query={query}
            onQuery={setQuery}
            kind={kind}
            onKind={setKind}
            counts={counts}
          />
          <div className="discover-grid">
            {visible.map((it) => (
              <SkillCard key={it.id} item={it} onOpen={() => setDetail(it)} onAdopt={adopt} />
            ))}
          </div>
          {visible.length === 0 && (
            <div className="no-results">Nothing matches those filters.</div>
          )}
        </>
      )}

      {detail && <SkillDetail item={detail} onClose={() => setDetail(null)} onAdopt={adopt} />}
    </div>
  );
}

/** A published item as a mock-style library card: tile + mono name + author + blurb + adopt footer. */
function SkillCard({
  item,
  onOpen,
  onAdopt,
}: {
  item: PublicItem;
  onOpen: () => void;
  onAdopt: (item: PublicItem, overwrite: boolean) => Promise<InstallOutcome>;
}) {
  const kind = toKind(item.kind);
  return (
    <button className="card skill-card" onClick={onOpen}>
      <div className="skill-card-body">
        <div className="skill-card-head">
          <KindTile kind={kind} />
          <div className="skill-card-id">
            <div className="skill-card-name mono">{item.name}</div>
            <div className="by-line">by {item.owner_name ?? "Unknown"}</div>
          </div>
        </div>
        <p className="blurb">{preview(item.body)}</p>
        <div className="skill-card-tags">
          <span className="tag">{KIND_META[kind].label.toLowerCase()}</span>
          <span className="tag">v{item.latest_revision}</span>
        </div>
      </div>
      <div className="skill-card-foot" onClick={(e) => e.stopPropagation()}>
        <AdoptControl item={item} onAdopt={onAdopt} />
      </div>
    </button>
  );
}

/** The full-content modal opened from a card — the mock's SkillDetail. */
function SkillDetail({
  item,
  onClose,
  onAdopt,
}: {
  item: PublicItem;
  onClose: () => void;
  onAdopt: (item: PublicItem, overwrite: boolean) => Promise<InstallOutcome>;
}) {
  const kind = toKind(item.kind);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <KindTile kind={kind} size={42} />
          <div className="skill-card-id">
            <div className="skill-card-name mono" style={{ fontSize: 16 }}>
              {item.name}
            </div>
            <div className="by-line">
              by {item.owner_name ?? "Unknown"} · v{item.latest_revision}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <AdoptControl item={item} onAdopt={onAdopt} />
          </div>
        </div>
        <div className="modal-body">
          <pre>{item.body}</pre>
        </div>
      </div>
    </div>
  );
}

/** Adopt → Adopted ✓ / Replace? / can't adopt — shared by card footer and detail modal. */
function AdoptControl({
  item,
  onAdopt,
}: {
  item: PublicItem;
  onAdopt: (item: PublicItem, overwrite: boolean) => Promise<InstallOutcome>;
}) {
  const [status, setStatus] = useState<AdoptStatus>("idle");
  const [msg, setMsg] = useState("");

  const run = async (overwrite: boolean) => {
    setStatus("working");
    try {
      const outcome = await onAdopt(item, overwrite);
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

  if (status === "working") return <span className="pub-tag busy">adopting…</span>;
  if (status === "done") return <span className="pub-tag published">Adopted ✓</span>;
  if (status === "exists")
    return (
      <button className="pub-btn ghost" title="Already present — replace it" onClick={() => run(true)}>
        Replace?
      </button>
    );
  if (status === "unsupported")
    return (
      <span className="pub-tag busy" title="Memory, or a rule that needs a manual merge">
        can’t adopt
      </span>
    );
  if (status === "error")
    return (
      <span className="pub-tag busy" title={msg}>
        failed
      </span>
    );
  return (
    <button className="pub-btn" onClick={() => run(false)}>
      Adopt
    </button>
  );
}
