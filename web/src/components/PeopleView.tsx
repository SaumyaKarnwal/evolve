import { useMemo, useState } from "react";
import { type Item, type Kind, KIND_META, type PublicItem } from "../types";
import { adoptItem, type InstallOutcome } from "../dataSource";
import { preview } from "../lib/grouping";
import { KindDot } from "./KindDot";

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

/** "Adopt <name>'s build" — per-item Copy / Merge / Skip, like the mock's AdoptBuild. */
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
  const have = (it: PublicItem) =>
    localItems.some((l) => l.kind === toKind(it.kind) && l.name === it.name);

  const [destPath, setDestPath] = useState<string | null>(null);
  const [dec, setDec] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(person.items.map((it) => [it.id, have(it) ? "merge" : "copy"])),
  );
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c: Record<Decision, number> = { copy: 0, merge: 0, skip: 0 };
    for (const v of Object.values(dec)) c[v]++;
    return c;
  }, [dec]);

  const apply = async () => {
    setBusy(true);
    for (const it of person.items) {
      const d = dec[it.id];
      if (d === "skip") continue;
      setStatus((s) => ({ ...s, [it.id]: "working" }));
      try {
        const o = await adoptItem(it, d === "merge", destPath); // merge = overwrite
        setStatus((s) => ({ ...s, [it.id]: o }));
      } catch {
        setStatus((s) => ({ ...s, [it.id]: "error" }));
      }
    }
    setBusy(false);
  };

  const byKind = new Map<Kind, PublicItem[]>();
  for (const k of Object.keys(KIND_META) as Kind[]) {
    const inK = person.items.filter((i) => toKind(i.kind) === k);
    if (inK.length) byKind.set(k, inK);
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720, maxHeight: "86vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="avatar">{initialsOf(person.name)}</span>
          <div className="skill-card-id">
            <div className="serif" style={{ fontSize: 19, fontWeight: 600 }}>
              Adopt {person.name}’s build
            </div>
            <div className="by-line">{person.items.length} items · choose what to bring in</div>
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
                return (
                  <div className="ab-row" key={it.id}>
                    <KindDot kind={k} />
                    <div className="ab-row-id">
                      <span className="mono ab-name">{it.name}</span>
                      <span className="ab-desc">{preview(it.body)}</span>
                    </div>
                    {st ? (
                      <RowStatusBadge st={st} />
                    ) : (
                      <Seg
                        value={dec[it.id]}
                        onChange={(v) => setDec((d) => ({ ...d, [it.id]: v }))}
                        canMerge={have(it)}
                      />
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
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            {busy ? "Close" : "Cancel"}
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={apply}>
            {busy ? "Adopting…" : `Adopt selected (${counts.copy + counts.merge})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Seg({
  value,
  onChange,
  canMerge,
}: {
  value: Decision;
  onChange: (v: Decision) => void;
  canMerge: boolean;
}) {
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
    <div className="seg">
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
