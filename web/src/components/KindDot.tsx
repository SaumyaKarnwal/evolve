import { type Kind, KIND_META } from "../types";

/** The small accent dot that color-codes a kind (coral=skill, sage=rule, …). */
export function KindDot({ kind }: { kind: Kind }) {
  return <span className={`kind-dot ${KIND_META[kind].dotClass}`} />;
}
