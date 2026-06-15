import type { Item } from "../types";
import type { PublishApi } from "../hooks/publishContext";

/** The per-item publish control: Publish / Published·vN / Publish update (drift). Hidden when signed out. */
export function PublishButton({ item, api }: { item: Item; api: PublishApi }) {
  if (!api.signedIn) return null;

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation(); // don't toggle the card's expand when clicking the control
    fn();
  };

  if (api.isBusy(item)) return <span className="pub-tag busy">working…</span>;

  const state = api.stateOf(item);
  if (state.status === "unpublished") {
    return (
      <button className="pub-btn" onClick={stop(() => api.publish(item))}>
        Publish
      </button>
    );
  }
  if (state.status === "drifted") {
    // published at vN, but local content has changed since — offer to publish the new version
    return (
      <>
        <span className="tag" title="Currently published version">
          v{state.revision}
        </span>
        <button
          className="pub-btn drift"
          title="Your local copy changed — publish it as a new version"
          onClick={stop(() => api.publish(item))}
        >
          Publish update
        </button>
      </>
    );
  }
  // published and in sync
  return (
    <button
      className="pub-tag published"
      title="Published — click to unpublish"
      onClick={stop(() => api.unpublish(item))}
    >
      Published · v{state.revision}
    </button>
  );
}
