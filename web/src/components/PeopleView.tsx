import { useMemo, useState } from "react";
import { type Item, type Kind, KIND_META, type PublicItem } from "../types";
import { adoptItem, adoptRaw, recordPull, type InstallOutcome } from "../dataSource";
import { preview } from "../lib/grouping";
import { buildMerge } from "../lib/diff";
import { KindDot } from "./KindDot";
import { Markdown } from "./Markdown";
import { MergeView } from "./MergeView";

const toKind = (k: string): Kind => (k.charAt(0).toUpperCase() + k.slice(1)) as Kind;

const initialsOf = (name: string) =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

interface Person {
  name: string;
  items: PublicItem[];
}
interface DestOption {
  label: string;
  path: string | null;
}
interface PeopleViewProps {
  items: PublicItem[] | null;
  loading: boolean;
  error: string | null;
  mineIds: Set<string>;
  destinations: DestOption[];
  localItems: Item[];
}

export function PeopleView({ items, loading, error, mineIds, destinations, localItems }: PeopleViewProps) {
  const [open, setOpen] = useState<Person | null>(null);

  const people = useMemo<Person[]>(() => {
    const by = new Map<string, PublicItem[]>();
    for (const it of items ?? []) {
      if (mineIds.has(it.id)) continue;
      const who = it.owner_name ?? "Unknown";
      (by.get(who) ?? by.set(who, []).get(who)!).push(it);
    }
    return [...by.entries()]
      .map(([name, list]) => ({ name, items: list }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [items, mineIds]);

  if (error) return <div className="error">People: {error}</div>;
  if (loading && !items)
    return (
      <div className="loading">
        <span className="spinner" /> Finding builders…
      </div>
    );
  if (!items) return null;

  return (
    <div className="discover">
      <div className="eyebrow">Builders worth following</div>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em", margin: "6px 0 0" }}>
        People
      </h1>
      <p className="sub" style={{ maxWidth: 560, marginBottom: 24 }}>
        Find someone more capable in a domain, see what they’ve published, and inherit their setup.
      </p>
      {people.length === 0 ? (
        <p className="discover-empty">No one else has published yet.</p>
      ) : (
        <div className="people-grid">
          {people.map((p) => (
            <button key={p.name} className="card person-card" onClick={() => setOpen(p)}>
              <span className="avatar lg">{initialsOf(p.name)}</span>
              <div className="person-id">
                <div className="person-name serif">{p.name}</div>
                <div className="by-line">
                  {p.items.length} published item{p.items.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="person-kinds">
                {[...new Set(p.items.map((i) => toKind(i.kind)))].map((k) => (
                  <KindDot key={k} kind={k} />
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <AdoptBuild person={open} localItems={localItems} destinations={destinations} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

type Decision = "copy" | "merge" | "skip";
type RowStatus = "" | "working" | InstallOutcome | "error";
interface Merge {
  incoming: PublicItem;
  target: Item;
}

/** "Adopt <name>'s build" — see each item, choose Copy / Merge (into one of yours) / Skip. */
function AdoptBuild({
  person,
  localItems,
  destinations,
  onClose,
}: {
  person: Person;
  localItems: Item[];
  destinations: DestOption[];
  onClose: () => void;
}) {
  // your items by kind, for the merge-target picker
  const mine = useMemo(() => {
    const m = new Map<Kind, Item[]>();
    for (const it of localItems) (m.get(it.kind) ?? m.set(it.kind, []).get(it.kind)!).push(it);
    return m;
  }, [localItems]);
  const sameName = (it: PublicItem) =>
    (mine.get(toKind(it.kind)) ?? []).find((l) => l.name === it.name);

  // Default per item: don't have it → copy; have an identical copy → skip (no-op);
  // have it but it differs → merge (so overlaps get reconciled, not blindly overwritten).
  const defaultDecision = (it: PublicItem): Decision => {
    const existing = sameName(it);
    if (!existing) return "copy";
    return existing.body.trim() === it.body.trim() ? "skip" : "merge";
  };

  const [destPath, setDestPath] = useState<string | null>(null);
  const [dec, setDec] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(person.items.map((it) => [it.id, defaultDecision(it)])),
  );
  const [target, setTarget] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      person.items.map((it) => [
        it.id,
        (sameName(it) ?? mine.get(toKind(it.kind))?.[0])?.name ?? "",
      ]),
    ),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<Merge[]>([]);
  const [qi, setQi] = useState(-1);

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const counts = useMemo(() => {
    const c: Record<Decision, number> = { copy: 0, merge: 0, skip: 0 };
    for (const v of Object.values(dec)) c[v]++;
    return c;
  }, [dec]);

  const apply = async () => {
    setBusy(true);
    const merges: Merge[] = [];
    for (const it of person.items) {
      const d = dec[it.id];
      if (d === "skip") continue;
      if (d === "merge") {
        const tgt = (mine.get(toKind(it.kind)) ?? []).find((l) => l.name === target[it.id]);
        if (tgt) {
          merges.push({ incoming: it, target: tgt });
          continue;
        }
        // no target → fall back to a copy
      }
      setStatus((s) => ({ ...s, [it.id]: "working" }));
      try {
        const o = await adoptItem(it, false, destPath);
        setStatus((s) => ({ ...s, [it.id]: o }));
        if (o === "Created" || o === "Overwritten") recordPull(it.id).catch(() => {});
      } catch {
        setStatus((s) => ({ ...s, [it.id]: "error" }));
      }
    }
    if (merges.length) {
      setQueue(merges);
      setQi(0);
    } else {
      setBusy(false);
    }
  };

  const advance = () => {
    if (qi + 1 >= queue.length) {
      setQueue([]);
      setQi(-1);
      setBusy(false);
    } else {
      setQi(qi + 1);
    }
  };
  const resolveMerge = async (mergedBody: string) => {
    const { incoming, target: tgt } = queue[qi];
    setStatus((s) => ({ ...s, [incoming.id]: "working" }));
    try {
      const o = await adoptRaw(incoming.kind, tgt.name, mergedBody, true, destPath);
      setStatus((s) => ({ ...s, [incoming.id]: o }));
      recordPull(incoming.id).catch(() => {});
    } catch {
      setStatus((s) => ({ ...s, [incoming.id]: "error" }));
    }
    advance();
  };
  const skipMerge = () => {
    setStatus((s) => ({ ...s, [queue[qi].incoming.id]: "Unsupported" }));
    advance();
  };

  const byKind = new Map<Kind, PublicItem[]>();
  for (const k of Object.keys(KIND_META) as Kind[]) {
    const inK = person.items.filter((i) => toKind(i.kind) === k);
    if (inK.length) byKind.set(k, inK);
  }

  const current = qi >= 0 ? queue[qi] : null;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 760, maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="avatar">{initialsOf(person.name)}</span>
          <div className="skill-card-id">
            <div className="serif" style={{ fontSize: 19, fontWeight: 600 }}>
              Adopt {person.name}’s build
            </div>
            <div className="by-line">
              Copy what’s new, merge what overlaps into one of yours, skip the rest.
            </div>
          </div>
          <label className="dest-picker" style={{ marginLeft: "auto" }}>
            into
            <select value={destPath ?? ""} onChange={(e) => setDestPath(e.target.value || null)}>
              {destinations.map((d) => (
                <option key={d.label} value={d.path ?? ""}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="modal-body">
          {[...byKind.entries()].map(([k, list]) => (
            <section className="ab-section" key={k}>
              <div className="eyebrow ab-kind">{KIND_META[k].plural}</div>
              {list.map((it) => {
                const st = status[it.id] ?? "";
                const myKindItems = mine.get(k) ?? [];
                const isOpen = expanded.has(it.id);
                return (
                  <div className="ab-item" key={it.id}>
                    <div className="ab-row">
                      <button className="ab-expand" onClick={() => toggleExpand(it.id)}>
                        <span className={"chevron" + (isOpen ? " open" : "")}>▶</span>
                        <KindDot kind={k} />
                        <span className="ab-row-id">
                          <span className="ab-name">{it.name}</span>
                          <span className="ab-desc">{preview(it.body)}</span>
                        </span>
                      </button>
                      <div className="ab-controls">
                        {sameName(it) && <span className="tag">you have this</span>}
                        {st ? (
                          <RowStatusBadge st={st} />
                        ) : (
                          <Seg
                            value={dec[it.id]}
                            onChange={(v) => setDec((d) => ({ ...d, [it.id]: v }))}
                            canMerge={myKindItems.length > 0}
                          />
                        )}
                      </div>
                    </div>

                    {dec[it.id] === "merge" && !st && myKindItems.length > 0 && (
                      <div className="ab-target">
                        merge into
                        <select
                          value={target[it.id]}
                          onChange={(e) => setTarget((t) => ({ ...t, [it.id]: e.target.value }))}
                        >
                          {myKindItems.map((m) => (
                            <option key={m.name} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {isOpen && (
                      <div className="ab-content">
                        <Markdown text={it.body} />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <div className="modal-foot">
          <span className="ab-counts">
            {counts.copy} copy · {counts.merge} merge · {counts.skip} skip
            {counts.merge > 0 ? " · you’ll review each merge" : ""}
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            {busy ? "Close" : "Cancel"}
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={apply}>
            {busy ? "Adopting…" : `Adopt selected (${counts.copy + counts.merge})`}
          </button>
        </div>
      </div>

      {current && (
        <MergeView
          title={`Merge ${current.incoming.name} → ${current.target.name}`}
          name={current.incoming.name}
          subtitle={`Fold ${person.name}’s ${current.incoming.name} into your ${current.target.name} — pick, or adapt with AI.`}
          merge={buildMerge(current.target.body, current.incoming.body)}
          onApply={resolveMerge}
          onCancel={skipMerge}
        />
      )}
    </div>
  );
}

function Seg({ value, onChange, canMerge }: { value: Decision; onChange: (v: Decision) => void; canMerge: boolean }) {
  const opts: { v: Decision; label: string }[] = canMerge
    ? [
        { v: "copy", label: "Copy" },
        { v: "merge", label: "Merge" },
        { v: "skip", label: "Skip" },
      ]
    : [
        { v: "copy", label: "Copy" },
        { v: "skip", label: "Skip" },
      ];
  return (
    <div className="seg" onClick={(e) => e.stopPropagation()}>
      {opts.map((o) => (
        <button
          key={o.v}
          className={"seg-opt" + (value === o.v ? ` sel sel-${o.v}` : "")}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RowStatusBadge({ st }: { st: RowStatus }) {
  if (st === "working") return <span className="pub-tag busy">…</span>;
  if (st === "Created" || st === "Overwritten") return <span className="pub-tag published">Adopted ✓</span>;
  if (st === "Exists") return <span className="pub-tag busy">already have</span>;
  if (st === "Unsupported") return <span className="pub-tag busy">skipped</span>;
  if (st === "error") return <span className="pub-tag busy">failed</span>;
  return null;
}
