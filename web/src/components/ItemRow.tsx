import { useState } from "react";
import type { Item } from "../types";
import { preview } from "../lib/grouping";
import { projectName } from "../lib/projects";
import { adoptRaw } from "../dataSource";
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
  const isProject = item.scope !== "Global"; // project-scoped items can be promoted to global
  const [promo, setPromo] = useState<"" | "working" | "done" | "exists" | "na" | "error">("");

  const promote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPromo("working");
    try {
      const o = await adoptRaw(item.kind, item.name, item.body, false, null);
      setPromo(o === "Created" || o === "Overwritten" ? "done" : o === "Exists" ? "exists" : "na");
    } catch {
      setPromo("error");
    }
  };

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
          {isProject &&
            (promo === "done" ? (
              <span className="pub-tag published">→ Global ✓</span>
            ) : promo === "exists" ? (
              <span className="pub-tag busy">in Global</span>
            ) : promo === "working" ? (
              <span className="pub-tag busy">…</span>
            ) : promo === "na" ? (
              <span className="pub-tag busy">n/a</span>
            ) : (
              <button className="pub-btn ghost" title="Copy to your global ~/.claude" onClick={promote}>
                Promote
              </button>
            ))}
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
