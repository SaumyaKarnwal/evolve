import { useMemo, useState } from "react";
import { applyMerge, type Merge } from "../lib/diff";

interface MergeViewProps {
  title: string;
  subtitle: string;
  merge: Merge;
  onApply: (mergedText: string) => void;
  onCancel: () => void;
}

const KIND_TAG: Record<string, { label: string; cls: string }> = {
  add: { label: "Their addition", cls: "t-add" },
  local: { label: "Your local edit", cls: "t-local" },
  modify: { label: "Reworded", cls: "t-modify" },
};

type Choice = "theirs" | "mine";

/** The mock's MergeView: resolve each change (take theirs / keep mine) with a live merged preview. */
export function MergeView({ title, subtitle, merge, onApply, onCancel }: MergeViewProps) {
  const [decisions, setDecisions] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(merge.hunks.map((h) => [h.id, h.kind === "local" ? "mine" : "theirs"])),
  );
  const set = (id: string, v: Choice) => setDecisions((d) => ({ ...d, [id]: v }));
  const all = (v: Choice) => setDecisions(Object.fromEntries(merge.hunks.map((h) => [h.id, v])));
  const taken = Object.values(decisions).filter((d) => d === "theirs").length;

  const preview = useMemo(() => {
    const rows: { t: "ctx" | "their" | "your"; text: string }[] = [];
    for (const seg of merge.context) {
      if (seg.type === "ctx") {
        seg.lines.forEach((l) => rows.push({ t: "ctx", text: l }));
      } else {
        const h = merge.hunks.find((x) => x.id === seg.id)!;
        const lines = decisions[h.id] === "theirs" ? h.theirs : h.yours;
        lines.forEach((l) => rows.push({ t: decisions[h.id] === "theirs" ? "their" : "your", text: l }));
      }
    }
    return rows;
  }, [decisions, merge]);

  return (
    <div className="scrim" onClick={onCancel}>
      <div className="modal merge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="kind-tile k-rule" style={{ width: 38, height: 38, fontSize: 16 }}>
            ⌥
          </span>
          <div className="skill-card-id">
            <div className="serif" style={{ fontSize: 20, fontWeight: 600 }}>
              {title}
            </div>
            <div className="by-line">{subtitle}</div>
          </div>
          <button className="iconbtn" style={{ marginLeft: "auto" }} onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="merge-cols">
          <div className="merge-left">
            <div className="merge-left-head">
              <span className="eyebrow">
                {merge.hunks.length} change{merge.hunks.length === 1 ? "" : "s"} to resolve
              </span>
              <span className="merge-allbtns">
                <button className="chip" onClick={() => all("theirs")}>
                  Take all theirs
                </button>
                <button className="chip" onClick={() => all("mine")}>
                  Keep all mine
                </button>
              </span>
            </div>

            {merge.hunks.map((h) => (
              <div className="hunk-card" key={h.id}>
                <div className="hunk-head">
                  <span className={`tag ${KIND_TAG[h.kind].cls}`}>{KIND_TAG[h.kind].label}</span>
                  <span className="hunk-label">{h.label || "(blank)"}</span>
                </div>
                <div className="hunk-opts">
                  {h.theirs.length > 0 && (
                    <button
                      className={"hunk-opt" + (decisions[h.id] === "theirs" ? " sel" : "")}
                      onClick={() => set(h.id, "theirs")}
                    >
                      <span className="hunk-opt-tag">theirs</span>
                      <pre>{h.theirs.join("\n")}</pre>
                    </button>
                  )}
                  {h.yours.length > 0 && (
                    <button
                      className={"hunk-opt" + (decisions[h.id] === "mine" ? " sel" : "")}
                      onClick={() => set(h.id, "mine")}
                    >
                      <span className="hunk-opt-tag">mine</span>
                      <pre>{h.yours.join("\n")}</pre>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="merge-right">
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Merged preview
            </div>
            <div className="diff">
              {preview.map((r, i) => (
                <div
                  key={i}
                  className={
                    "diff-line " +
                    (r.t === "their" ? "dl-add" : r.t === "your" ? "dl-your" : "dl-ctx")
                  }
                >
                  <span className="gutter">
                    {r.t === "their" ? "+" : r.t === "your" ? "~" : " "}
                  </span>
                  {r.text || " "}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="merge-foot">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onApply(applyMerge(merge, decisions))}>
            Apply{taken ? ` · ${taken} from them` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
