import { useState } from "react";
import type { Item } from "../types";
import { preview } from "../lib/grouping";
import { projectName } from "../lib/projects";
import { usePublish } from "../hooks/publishContext";
import { KindDot } from "./KindDot";
import { PublishButton } from "./PublishButton";
import { Markdown } from "./Markdown";

interface ItemRowProps {
  item: Item;
  /** Show which project this item belongs to (used in the cross-project "All" view). */
  showProject?: boolean;
}

/** One item as an expandable card: dot + name + preview + publish control; click to reveal the body. */
export function ItemRow({ item, showProject }: ItemRowProps) {
  const [open, setOpen] = useState(false);
  const publish = usePublish();

  return (
    <div className={`card item-card${open ? " open" : ""}`}>
      <div className="item-row" onClick={() => setOpen((o) => !o)}>
        <KindDot kind={item.kind} />
        <span
          className={
            "item-name" +
            (item.kind === "Skill" || item.kind === "Command" || item.kind === "Agent" ? " mono" : "")
          }
        >
          {item.name}
        </span>
        {item.source_anchor && item.source_anchor !== item.name && (
          <span className="item-anchor">· {item.source_anchor}</span>
        )}
        {!open && <span className="item-preview">{preview(item.body)}</span>}
        <span className="item-meta">
          {showProject && <span className="tag">{projectName(item.scope)}</span>}
          {publish && <PublishButton item={item} api={publish} />}
          <span className="chevron">▶</span>
        </span>
      </div>
      {open && (
        <div className="item-body">
          <Markdown text={item.body} />
          <div className="item-foot">
            <span className="item-hash">sha256 · {item.content_hash.slice(0, 16)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
