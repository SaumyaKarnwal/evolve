import { type Kind, KINDS, KIND_META } from "../types";
import { KindDot } from "./KindDot";

interface FiltersProps {
  query: string;
  onQuery: (q: string) => void;
  kind: Kind | null;
  onKind: (k: Kind | null) => void;
  counts: Record<Kind, number>;
}

/** Sticky search box + kind-filter chips (each chip carries its accent dot + count). */
export function Filters({ query, onQuery, kind, onKind, counts }: FiltersProps) {
  return (
    <div className="filters">
      <input
        className="search"
        placeholder="Search names and contents…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <div className="chips">
        <button
          className={"chip" + (kind === null ? " is-active" : "")}
          onClick={() => onKind(null)}
        >
          All
        </button>
        {KINDS.map((k) => (
          <button
            key={k}
            className={"chip" + (kind === k ? " is-active" : "")}
            onClick={() => onKind(kind === k ? null : k)}
          >
            <KindDot kind={k} />
            {KIND_META[k].plural}
            <span className="chip-count">{counts[k]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
