import type { Item } from "../types";
import type { PublishApi } from "../hooks/publishContext";

/** Visibility pill (the mock's Public/Private): reflects + toggles publish state for an item. */
export function PublishButton({ item, api }: { item: Item; api: PublishApi }) {
  if (!api.signedIn) return null;

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  if (api.isBusy(item)) return <span className="vis vis-busy">…</span>;

  const state = api.stateOf(item);
  if (state.status === "unpublished") {
    return (
      <button className="vis vis-private" title="Private — click to publish" onClick={stop(() => api.publish(item))}>
        Private
      </button>
    );
  }
  if (state.status === "drifted") {
    return (
      <button
        className="vis vis-update"
        title="Public, but your local copy changed — click to publish the update"
        onClick={stop(() => api.publish(item))}
      >
        Update · v{state.revision}
      </button>
    );
  }
  return (
    <button
      className="vis vis-public"
      title="Public — click to unpublish (make private)"
      onClick={stop(() => api.unpublish(item))}
    >
      Public · v{state.revision}
    </button>
  );
}
