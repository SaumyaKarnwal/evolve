import { useMemo, useState } from "react";
import { applyMerge, type Merge } from "../lib/diff";

interface MergeViewProps {
  title: string;
  subtitle: string;
  merge: Merge;
  onApply: (mergedText: string) => void;
  onCancel: () => void;
}

const KIND_TAG: Record<string, string> = {
  add: "Their addition",
  local: "Only in yours",
  modify: "Changed",
};

type Choice = "theirs" | "mine";

/** A unified-diff merge: see exactly what differs (− yours / + theirs) and pick per change. */
export function MergeView({ title, subtitle, merge, onApply, onCancel }: MergeViewProps) {
  const [decisions, setDecisions] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(merge.hunks.map((h) => [h.id, h.kind === "local" ? "mine" : "theirs"])),
  );
  const set = (id: string, v: Choice) => setDecisions((d) => ({ ...d, [id]: v }));
  const all = (v: Choice) => setDecisions(Object.fromEntries(merge.hunks.map((h) => [h.id, v])));
  const taken = Object.values(decisions).filter((d) => d === "theirs").length;
  const noChanges = merge.hunks.length === 0;

  const rows = useMemo(() => {
    const out: { kind: "ctx" | "hunk"; lines?: string[]; hunkId?: string }[] = [];
    for (const seg of merge.context) {
      if (seg.type === "ctx") out.push({ kind: "ctx", lines: seg.lines });
      else out.push({ kind: "hunk", hunkId: seg.id });
    }
    return out;
  }, [merge]);

  return (
    <div className="scrim" onClick={onCancel}>
      <div className="modal merge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="kind-tile k-rule" style={{ width: 38, height: 38, fontSize: 16 }}>
            ⌥
          </span>
          <div className="skill-card-id">
            <div className="serif" style={{ fontSize: 19, fontWeight: 600 }}>
              {title}
            </div>
            <div className="by-line">{subtitle}</div>
          </div>
          <button className="iconbtn" style={{ marginLeft: "auto" }} onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="merge-bar">
          <span className="eyebrow">
            {noChanges
              ? "Identical — nothing to merge"
              : `${merge.hunks.length} change${merge.hunks.length === 1 ? "" : "s"} · `}
          </span>
          {!noChanges && (
            <span className="merge-legend">
              <span className="legend-rem">− yours</span>
              <span className="legend-add">+ theirs</span>
            </span>
          )}
          {!noChanges && (
            <span className="merge-allbtns">
              <button className="chip" onClick={() => all("mine")}>
                Keep all mine
              </button>
              <button className="chip" onClick={() => all("theirs")}>
                Take all theirs
              </button>
            </span>
          )}
        </div>

        <div className="udiff">
          {rows.map((r, i) => {
            if (r.kind === "ctx") {
              return r.lines!.map((l, j) => (
                <div className="uline uctx" key={`c${i}-${j}`}>
                  <span className="ugut"> </span>
                  {l || " "}
                </div>
              ));
            }
            const h = merge.hunks.find((x) => x.id === r.hunkId)!;
            const choice = decisions[h.id];
            return (
              <div className="uhunk" key={`h${i}`}>
                <div className="uhunk-bar">
                  <span className="uhunk-tag">{KIND_TAG[h.kind]}</span>
                  <div className="seg">
                    <button
                      className={"seg-opt" + (choice === "mine" ? " sel" : "")}
                      onClick={() => set(h.id, "mine")}
                      disabled={h.yours.length === 0}
                    >
                      Keep yours
                    </button>
                    <button
                      className={"seg-opt" + (choice === "theirs" ? " sel sel-merge" : "")}
                      onClick={() => set(h.id, "theirs")}
                      disabled={h.theirs.length === 0}
                    >
                      Take theirs
                    </button>
                  </div>
                </div>
                {h.yours.map((l, j) => (
                  <div className={"uline urem" + (choice === "mine" ? " chosen" : " dim")} key={`y${j}`}>
                    <span className="ugut">−</span>
                    {l || " "}
                  </div>
                ))}
                {h.theirs.map((l, j) => (
                  <div className={"uline uadd" + (choice === "theirs" ? " chosen" : " dim")} key={`t${j}`}>
                    <span className="ugut">+</span>
                    {l || " "}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="merge-foot">
          <span className="ab-counts">
            {noChanges ? "no differences" : `${taken} of ${merge.hunks.length} taken from them`}
          </span>
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
