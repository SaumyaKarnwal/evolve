interface EmptyStateProps {
  onSync: () => void;
  canSync: boolean;
}

/** First-run state: a prompt to run the initial sync. */
export function EmptyState({ onSync, canSync }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty-mark">✶</div>
      <h2>Bring your Claude setup into view</h2>
      <p>Skills, rules, memory, commands and agents — across every project.</p>
      <button className="btn btn-primary btn-lg" onClick={onSync}>
        Sync your Claude
      </button>
      {!canSync && (
        <p className="hint">
          (Running in a browser — Sync needs the desktop app to read your files.)
        </p>
      )}
    </div>
  );
}
