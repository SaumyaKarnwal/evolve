import { useMemo, useState } from "react";
import { applyMerge, type Merge } from "../lib/diff";
import { Markdown } from "./Markdown";

interface MergeViewProps {
  title: string;
  subtitle: string;
  merge: Merge;
  onApply: (mergedText: string) => void;
  onCancel: () => void;
}

const KIND_TAG: Record<string, { label: string; cls: string }> = {
  add: { label: "Their addition", cls: "t-add" },
  local: { label: "Only yours", cls: "t-local" },
  modify: { label: "Reworded", cls: "t-modify" },
};

type Choice = "theirs" | "mine";
type RightView = "merged" | "yours" | "theirs";

/** Resolve a merge: see your version, their version, and the live merged result; choose per change. */
export function MergeView({ title, subtitle, merge, onApply, onCancel }: MergeViewProps) {
  const [decisions, setDecisions] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(merge.hunks.map((h) => [h.id, h.kind === "local" ? "mine" : "theirs"])),
  );
  const [view, setView] = useState<RightView>("merged");
  const set = (id: string, v: Choice) => setDecisions((d) => ({ ...d, [id]: v }));
  const all = (v: Choice) => setDecisions(Object.fromEntries(merge.hunks.map((h) => [h.id, v])));
  const taken = Object.values(decisions).filter((d) => d === "theirs").length;

  const allMine = useMemo(() => Object.fromEntries(merge.hunks.map((h) => [h.id, "mine" as Choice])), [merge]);
  const allTheirs = useMemo(() => Object.fromEntries(merge.hunks.map((h) => [h.id, "theirs" as Choice])), [merge]);
  const yoursFull = useMemo(() => applyMerge(merge, allMine), [merge, allMine]);
  const theirsFull = useMemo(() => applyMerge(merge, allTheirs), [merge, allTheirs]);

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

  const noChanges = merge.hunks.length === 0;

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
                {noChanges
                  ? "Identical — nothing to resolve"
                  : `${merge.hunks.length} change${merge.hunks.length === 1 ? "" : "s"}: yours vs theirs`}
              </span>
              {!noChanges && (
                <span className="merge-allbtns">
                  <button className="chip" onClick={() => all("theirs")}>
                    Take all theirs
                  </button>
                  <button className="chip" onClick={() => all("mine")}>
                    Keep all mine
                  </button>
                </span>
              )}
            </div>

            {merge.hunks.map((h) => (
              <div className="hunk-card" key={h.id}>
                <div className="hunk-head">
                  <span className={`tag ${KIND_TAG[h.kind].cls}`}>{KIND_TAG[h.kind].label}</span>
                  <span className="hunk-label">{h.label || "(blank)"}</span>
                </div>
                <div className="hunk-opts">
                  {h.yours.length > 0 && (
                    <button
                      className={"hunk-opt" + (decisions[h.id] === "mine" ? " sel" : "")}
                      onClick={() => set(h.id, "mine")}
                    >
                      <span className="hunk-opt-tag">yours (have)</span>
                      <pre>{h.yours.join("\n")}</pre>
                    </button>
                  )}
                  {h.theirs.length > 0 && (
                    <button
                      className={"hunk-opt" + (decisions[h.id] === "theirs" ? " sel" : "")}
                      onClick={() => set(h.id, "theirs")}
                    >
                      <span className="hunk-opt-tag">theirs (incoming)</span>
                      <pre>{h.theirs.join("\n")}</pre>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="merge-right">
            <div className="merge-right-head">
              <div className="seg">
                {(["merged", "yours", "theirs"] as RightView[]).map((v) => (
                  <button
                    key={v}
                    className={"seg-opt" + (view === v ? " sel" : "")}
                    onClick={() => setView(v)}
                  >
                    {v === "merged" ? "Merged result" : v === "yours" ? "Yours" : "Theirs"}
                  </button>
                ))}
              </div>
            </div>
            {view === "merged" ? (
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
            ) : (
              <div className="md-pane">
                <Markdown text={view === "yours" ? yoursFull : theirsFull} />
              </div>
            )}
          </div>
        </div>

        <div className="merge-foot">
          <span className="ab-counts">{taken} of {merge.hunks.length} taken from them</span>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onApply(applyMerge(merge, decisions))}>
            Apply merge
          </button>
        </div>
      </div>
    </div>
  );
}
