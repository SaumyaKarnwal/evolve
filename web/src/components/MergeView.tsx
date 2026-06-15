import { useMemo, useState } from "react";
import { applyMerge, buildMerge, type Merge } from "../lib/diff";
import { aiMerge } from "../dataSource";

interface MergeViewProps {
  title: string;
  subtitle: string;
  name: string;
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

/** Unified-diff merge: see what differs, pick per change, or let your Claude adapt it intelligently. */
export function MergeView({ title, subtitle, name, merge, onApply, onCancel }: MergeViewProps) {
  const [decisions, setDecisions] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(merge.hunks.map((h) => [h.id, h.kind === "local" ? "mine" : "theirs"])),
  );
  const set = (id: string, v: Choice) => setDecisions((d) => ({ ...d, [id]: v }));
  const all = (v: Choice) => setDecisions(Object.fromEntries(merge.hunks.map((h) => [h.id, v])));
  const taken = Object.values(decisions).filter((d) => d === "theirs").length;
  const noChanges = merge.hunks.length === 0;

  const yoursFull = useMemo(
    () => applyMerge(merge, Object.fromEntries(merge.hunks.map((h) => [h.id, "mine" as Choice]))),
    [merge],
  );
  const theirsFull = useMemo(
    () => applyMerge(merge, Object.fromEntries(merge.hunks.map((h) => [h.id, "theirs" as Choice]))),
    [merge],
  );

  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const runAi = async () => {
    setAiBusy(true);
    setAiErr(null);
    try {
      setAiResult(await aiMerge(name, yoursFull, theirsFull));
    } catch (e) {
      setAiErr(String(e));
    } finally {
      setAiBusy(false);
    }
  };

  // the merged text that will be applied
  const result = aiResult ?? applyMerge(merge, decisions);
  // when AI-merged, show the diff of yours → AI result; else the interactive yours/theirs diff
  const aiDiff = useMemo(() => (aiResult ? buildMerge(yoursFull, aiResult) : null), [aiResult, yoursFull]);

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
          {aiResult ? (
            <span className="eyebrow" style={{ color: "var(--ocean-700)" }}>
              ✨ AI-merged · review below
            </span>
          ) : (
            <span className="eyebrow">
              {noChanges
                ? "Identical — nothing to merge"
                : `${merge.hunks.length} change${merge.hunks.length === 1 ? "" : "s"} ·`}
            </span>
          )}
          {!aiResult && !noChanges && (
            <span className="merge-legend">
              <span className="legend-rem">− yours</span>
              <span className="legend-add">+ theirs</span>
            </span>
          )}
          <span className="merge-allbtns">
            {aiResult ? (
              <button className="chip" onClick={() => setAiResult(null)}>
                ↩ Back to manual
              </button>
            ) : (
              <>
                {!noChanges && (
                  <>
                    <button className="chip" onClick={() => all("mine")}>
                      Keep all mine
                    </button>
                    <button className="chip" onClick={() => all("theirs")}>
                      Take all theirs
                    </button>
                  </>
                )}
                <button className="chip ai" onClick={runAi} disabled={aiBusy}>
                  {aiBusy ? "✨ Adapting…" : "✨ Adapt with AI"}
                </button>
              </>
            )}
          </span>
        </div>

        {aiErr && <div className="error" style={{ margin: "10px 22px" }}>AI merge: {aiErr}</div>}

        <div className="udiff">
          {(aiResult ? aiDiff! : merge).context.map((seg, i) => {
            const m = aiResult ? aiDiff! : merge;
            if (seg.type === "ctx") {
              return seg.lines.map((l, j) => (
                <div className="uline uctx" key={`c${i}-${j}`}>
                  <span className="ugut"> </span>
                  {l || " "}
                </div>
              ));
            }
            const h = m.hunks.find((x) => x.id === seg.id)!;
            const choice = decisions[h.id];
            const aiMode = !!aiResult;
            return (
              <div className="uhunk" key={`h${i}`}>
                {!aiMode && (
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
                )}
                {h.yours.map((l, j) => (
                  <div
                    className={"uline urem" + (aiMode || choice === "mine" ? " chosen" : " dim")}
                    key={`y${j}`}
                  >
                    <span className="ugut">−</span>
                    {l || " "}
                  </div>
                ))}
                {h.theirs.map((l, j) => (
                  <div
                    className={"uline uadd" + (aiMode || choice === "theirs" ? " chosen" : " dim")}
                    key={`t${j}`}
                  >
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
            {aiResult
              ? "AI-merged — review and apply"
              : noChanges
                ? "no differences"
                : `${taken} of ${merge.hunks.length} taken from them`}
          </span>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onApply(result)}>
            Apply merge
          </button>
        </div>
      </div>
    </div>
  );
}
