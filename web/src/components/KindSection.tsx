import { type Item, type Kind, KIND_META } from "../types";
import { KindDot } from "./KindDot";
import { ItemRow } from "./ItemRow";
import { projectName } from "../lib/projects";

interface KindSectionProps {
  kind: Kind;
  items: Item[];
  /** Pass through to rows — show project tags in the cross-project "All" view. */
  showProject?: boolean;
}

/** A titled section for one kind: accent dot + serif heading + count + blurb, then the item cards. */
export function KindSection({ kind, items, showProject }: KindSectionProps) {
  const meta = KIND_META[kind];
  return (
    <section className="kind-section">
      <div className="kind-head">
        <div className="kind-head-title">
          <KindDot kind={kind} />
          <h2>{meta.plural}</h2>
          <span className="count">{items.length}</span>
        </div>
        <span className="blurb">{meta.blurb}</span>
      </div>
      <div className="item-list">
        {items.map((item) => (
          <ItemRow
            key={`${projectName(item.scope)}:${item.kind}:${item.name}`}
            item={item}
            showProject={showProject}
          />
        ))}
      </div>
    </section>
  );
}
