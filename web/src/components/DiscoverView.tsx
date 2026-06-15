import { useMemo, useState } from "react";
import { type Item, type Kind, KIND_META, type PublicItem } from "../types";
import { adoptItem, type InstallOutcome } from "../dataSource";
import { preview } from "../lib/grouping";
import { buildMerge } from "../lib/diff";
import { KindTile } from "./KindTile";
import { Filters } from "./Filters";
import { MergeView } from "./MergeView";

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
  /** Local scanned items — used to find "yours" when merging a rule. */
  localItems: Item[];
  /** Publication ids the signed-in user owns — shown as "Yours", not adoptable. */
  mineIds: Set<string>;
}

export function DiscoverView({
  items,
  loading,
  error,
  destinations,
  localItems,
  mineIds,
}: DiscoverViewProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [destPath, setDestPath] = useState<string | null>(null);
  const [detail, setDetail] = useState<PublicItem | null>(null);
  const [merging, setMerging] = useState<PublicItem | null>(null);

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

  // your local version of an incoming rule (for the merge diff)
  const yoursFor = (item: PublicItem): string =>
    localItems.find((i) => i.kind === toKind(item.kind) && i.name === item.name)?.body ?? "";

  const applyMergeResult = async (mergedBody: string) => {
    if (!merging) return;
    await adoptItem({ ...merging, body: mergedBody }, true, destPath).catch(() => {});
    setMerging(null);
  };

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
          <Filters query={query} onQuery={setQuery} kind={kind} onKind={setKind} counts={counts} />
          <div className="discover-grid">
            {visible.map((it) => (
              <SkillCard
                key={it.id}
                item={it}
                mine={mineIds.has(it.id)}
                onOpen={() => setDetail(it)}
                onAdopt={adopt}
                onMergeNeeded={() => setMerging(it)}
              />
            ))}
          </div>
          {visible.length === 0 && <div className="no-results">Nothing matches those filters.</div>}
        </>
      )}

      {detail && (
        <SkillDetail
          item={detail}
          mine={mineIds.has(detail.id)}
          onClose={() => setDetail(null)}
          onAdopt={adopt}
          onMergeNeeded={() => {
            setDetail(null);
            setMerging(detail);
          }}
        />
      )}

      {merging && (
        <MergeView
          title={`Merge ${merging.name}`}
          subtitle={`Fold ${merging.owner_name ?? "their"} version into your rule — pick what to keep.`}
          merge={buildMerge(yoursFor(merging), merging.body)}
          onApply={applyMergeResult}
          onCancel={() => setMerging(null)}
        />
      )}
    </div>
  );
}

function SkillCard({
  item,
  mine,
  onOpen,
  onAdopt,
  onMergeNeeded,
}: {
  item: PublicItem;
  mine: boolean;
  onOpen: () => void;
  onAdopt: (item: PublicItem, overwrite: boolean) => Promise<InstallOutcome>;
  onMergeNeeded: () => void;
}) {
  const kind = toKind(item.kind);
  return (
    <button className="card skill-card" onClick={onOpen}>
      <div className="skill-card-body">
        <div className="skill-card-head">
          <KindTile kind={kind} />
          <div className="skill-card-id">
            <div className="skill-card-name mono">{item.name}</div>
            <div className="by-line">{mine ? "published by you" : `by ${item.owner_name ?? "Unknown"}`}</div>
          </div>
        </div>
        <p className="blurb">{preview(item.body)}</p>
        <div className="skill-card-tags">
          <span className="tag">{KIND_META[kind].label.toLowerCase()}</span>
          <span className="tag">v{item.latest_revision}</span>
        </div>
      </div>
      <div className="skill-card-foot" onClick={(e) => e.stopPropagation()}>
        {mine ? (
          <span className="pub-tag published">Yours</span>
        ) : (
          <AdoptControl item={item} onAdopt={onAdopt} onMergeNeeded={onMergeNeeded} />
        )}
      </div>
    </button>
  );
}

function SkillDetail({
  item,
  mine,
  onClose,
  onAdopt,
  onMergeNeeded,
}: {
  item: PublicItem;
  mine: boolean;
  onClose: () => void;
  onAdopt: (item: PublicItem, overwrite: boolean) => Promise<InstallOutcome>;
  onMergeNeeded: () => void;
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
            {mine ? (
              <span className="pub-tag published">Yours</span>
            ) : (
              <AdoptControl item={item} onAdopt={onAdopt} onMergeNeeded={onMergeNeeded} />
            )}
          </div>
        </div>
        <div className="modal-body">
          <pre>{item.body}</pre>
        </div>
      </div>
    </div>
  );
}

/** Adopt → Adopted ✓ / Replace? / merge (rules) / can't adopt. */
function AdoptControl({
  item,
  onAdopt,
  onMergeNeeded,
}: {
  item: PublicItem;
  onAdopt: (item: PublicItem, overwrite: boolean) => Promise<InstallOutcome>;
  onMergeNeeded: () => void;
}) {
  const [status, setStatus] = useState<AdoptStatus>("idle");
  const [msg, setMsg] = useState("");
  const isRule = toKind(item.kind) === "Rule";

  const run = async (overwrite: boolean) => {
    setStatus("working");
    try {
      const outcome = await onAdopt(item, overwrite);
      if (outcome === "Created" || outcome === "Overwritten") {
        setStatus("done");
      } else if (outcome === "Exists") {
        // a rule that already exists → resolve via the merge view, not a blunt overwrite
        if (isRule) {
          setStatus("idle");
          onMergeNeeded();
        } else {
          setStatus("exists");
        }
      } else {
        setStatus("unsupported");
      }
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
      <span className="pub-tag busy" title="Memory isn’t adopted">
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
