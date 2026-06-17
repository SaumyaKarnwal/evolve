import { useMemo, useState } from "react";
import { applyMerge, type Merge } from "../lib/diff";
import { aiMerge } from "../dataSource";

interface MergeViewProps {
  title: string;
  subtitle: string;
  name: string;
  merge: Merge;
  onApply: (mergedText: string) => void;
  onCancel: () => void;
}

const KIND_TAG: Record<string, { label: string; cls: string }> = {
  add: { label: "Their addition", cls: "t-add" },
  local: { label: "Only in yours", cls: "t-local" },
  modify: { label: "Changed", cls: "t-modify" },
};

type Choice = "theirs" | "mine";

/**
 * Merge view (mock design): pick each change on the left, watch the merged file build on the right.
 * "Adapt with AI" folds both full versions with your own Claude instead of hand-picking.
 */
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

  // the merged text — live as you pick, or the AI result once adapted
  const merged = aiResult ?? applyMerge(merge, decisions);

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

        <div className="merge-cols">
          {/* LEFT — the changes to reconcile */}
          <div className="merge-left">
            <div className="merge-left-head">
              <span className="eyebrow">
                {aiResult
                  ? "✨ AI-merged"
                  : noChanges
                    ? "Identical — nothing to merge"
                    : `${merge.hunks.length} change${merge.hunks.length === 1 ? "" : "s"} to reconcile`}
              </span>
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

            {aiErr && <div className="error" style={{ marginBottom: 12 }}>AI merge: {aiErr}</div>}

            {noChanges && (
              <div className="md-pane" style={{ color: "var(--muted)" }}>
                Your version and theirs are identical — there's nothing to reconcile.
              </div>
            )}

            {merge.hunks.map((h) => {
              const choice = decisions[h.id];
              const meta = KIND_TAG[h.kind];
              return (
                <div className="hunk-card" key={h.id}>
                  <div className="hunk-head">
                    <span className={`tag ${meta.cls}`}>{meta.label}</span>
                    <span className="hunk-label">{h.label}</span>
                  </div>
                  <div className="hunk-opts">
                    {h.yours.length > 0 && (
                      <button
                        className={"hunk-opt" + (!aiResult && choice === "mine" ? " sel" : "")}
                        onClick={() => set(h.id, "mine")}
                        disabled={!!aiResult}
                      >
                        <div className="hunk-opt-tag">Keep yours</div>
                        <pre>{h.yours.join("\n")}</pre>
                      </button>
                    )}
                    {h.theirs.length > 0 && (
                      <button
                        className={"hunk-opt" + (!aiResult && choice === "theirs" ? " sel" : "")}
                        onClick={() => set(h.id, "theirs")}
                        disabled={!!aiResult}
                      >
                        <div className="hunk-opt-tag">Take theirs</div>
                        <pre>{h.theirs.join("\n")}</pre>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT — the merged file, live */}
          <div className="merge-right">
            <div className="merge-right-head">
              <span className="eyebrow">{aiResult ? "✨ Merged result" : "Merged result"}</span>
            </div>
            <pre className="merge-preview">{merged}</pre>
          </div>
        </div>

        <div className="merge-foot">
          <span className="ab-counts" style={{ marginRight: "auto" }}>
            {aiResult
              ? "AI-merged — review and apply"
              : noChanges
                ? "no differences"
                : `${taken} of ${merge.hunks.length} taken from them`}
          </span>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onApply(merged)}>
            Apply merge
          </button>
        </div>
      </div>
    </div>
  );
}
