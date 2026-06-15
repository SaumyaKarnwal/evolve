import { useMemo, useState } from "react";
import { type Item, type Kind, type PublicItem } from "../types";
import { adoptItem, type InstallOutcome } from "../dataSource";
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
  /** ids the signed-in user owns — used to exclude yourself from "people". */
  mineIds: Set<string>;
  destinations: DestOption[];
  localItems: Item[];
}

export function PeopleView({ items, loading, error, mineIds, destinations }: PeopleViewProps) {
  const [openName, setOpenName] = useState<string | null>(null);

  // people = authors of public items that aren't yours
  const people = useMemo<Person[]>(() => {
    const by = new Map<string, PublicItem[]>();
    for (const it of items ?? []) {
      if (mineIds.has(it.id)) continue; // exclude your own publications
      const who = it.owner_name ?? "Unknown";
      (by.get(who) ?? by.set(who, []).get(who)!).push(it);
    }
    return [...by.entries()]
      .map(([name, list]) => ({ name, items: list }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [items, mineIds]);

  if (error) return <div className="error">People: {error}</div>;
  if (loading && !items) {
    return (
      <div className="loading">
        <span className="spinner" /> Finding builders…
      </div>
    );
  }
  if (!items) return null;

  const open = people.find((p) => p.name === openName) ?? null;
  if (open) {
    return <PersonBuild person={open} destinations={destinations} onBack={() => setOpenName(null)} />;
  }

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
            <button key={p.name} className="card person-card" onClick={() => setOpenName(p.name)}>
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
    </div>
  );
}

type RowStatus = "" | "working" | "Created" | "Overwritten" | "Exists" | "Unsupported" | "error";

/** A person's build: their published items with select + Adopt selected / Adopt build. */
function PersonBuild({
  person,
  destinations,
  onBack,
}: {
  person: Person;
  destinations: DestOption[];
  onBack: () => void;
}) {
  const [destPath, setDestPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(person.items.map((i) => i.id)));
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const adoptThese = async (list: PublicItem[]) => {
    setBusy(true);
    for (const it of list) {
      setStatus((s) => ({ ...s, [it.id]: "working" }));
      try {
        const outcome: InstallOutcome = await adoptItem(it, false, destPath);
        setStatus((s) => ({ ...s, [it.id]: outcome }));
      } catch {
        setStatus((s) => ({ ...s, [it.id]: "error" }));
      }
    }
    setBusy(false);
  };

  const selectedItems = person.items.filter((i) => selected.has(i.id));

  return (
    <div className="discover">
      <button className="back-link" onClick={onBack}>
        ‹ All people
      </button>
      <div className="person-build-head">
        <span className="avatar lg">{initialsOf(person.name)}</span>
        <div className="person-id">
          <div className="person-name serif" style={{ fontSize: 26 }}>
            {person.name}
          </div>
          <div className="by-line">{person.items.length} published items</div>
        </div>
        <label className="dest-picker" style={{ marginLeft: "auto" }}>
          Adopt into
          <select value={destPath ?? ""} onChange={(e) => setDestPath(e.target.value || null)}>
            {destinations.map((d) => (
              <option key={d.label} value={d.path ?? ""}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="person-build-actions">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => adoptThese(person.items)}
        >
          Adopt build
        </button>
        <button
          className="btn btn-secondary"
          disabled={busy || selectedItems.length === 0}
          onClick={() => adoptThese(selectedItems)}
        >
          Adopt selected ({selectedItems.length})
        </button>
      </div>

      <div className="item-list" style={{ marginTop: 16 }}>
        {person.items.map((it) => {
          const st = status[it.id] ?? "";
          return (
            <label className="card build-row" key={it.id}>
              <input
                type="checkbox"
                checked={selected.has(it.id)}
                onChange={() => toggle(it.id)}
              />
              <KindDot kind={toKind(it.kind)} />
              <span className="item-name">{it.name}</span>
              <span className="item-meta">
                <span className="tag">v{it.latest_revision}</span>
                {st === "working" && <span className="pub-tag busy">…</span>}
                {(st === "Created" || st === "Overwritten") && (
                  <span className="pub-tag published">Adopted ✓</span>
                )}
                {st === "Exists" && <span className="pub-tag busy">already have</span>}
                {st === "Unsupported" && <span className="pub-tag busy">skipped</span>}
                {st === "error" && <span className="pub-tag busy">failed</span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
