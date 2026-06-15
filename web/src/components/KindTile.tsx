import { type Kind, KIND_META } from "../types";

/** The mock's rounded, kind-colored icon tile (here: the kind's initial on a tinted square). */
export function KindTile({ kind, size = 34 }: { kind: Kind; size?: number }) {
  return (
    <span
      className={`kind-tile ${KIND_META[kind].dotClass}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {kind.charAt(0)}
    </span>
  );
}
