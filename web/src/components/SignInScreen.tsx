interface SignInScreenProps {
  onSignIn: () => void;
  busy: boolean;
  canSignIn: boolean; // false in a plain browser (needs the desktop app)
  error?: string | null;
}

/** The start screen: Evolve must be signed in before showing your setup. */
export function SignInScreen({ onSignIn, busy, canSignIn, error }: SignInScreenProps) {
  return (
    <div className="signin">
      <div className="signin-card">
        <div className="wordmark serif">
          Evolve<span className="dot">.</span>
        </div>
        <p className="signin-tag">Sync, share, and pull your Claude setup.</p>
        <button
          className="btn btn-primary btn-lg"
          onClick={onSignIn}
          disabled={busy || !canSignIn}
        >
          {busy ? "Signing in…" : "Sign in with Google"}
        </button>
        {!canSignIn && <p className="hint">Open the Evolve desktop app to sign in.</p>}
        {error && <p className="signin-error">{error}</p>}
      </div>
    </div>
  );
}
