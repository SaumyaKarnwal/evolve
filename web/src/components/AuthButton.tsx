import type { UserInfo } from "../types";

interface AuthButtonProps {
  user: UserInfo | null;
  busy: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

/** Top-bar auth control: "Sign in with Google" when signed out, the user's name (→ sign out) when in. */
export function AuthButton({ user, busy, onSignIn, onSignOut }: AuthButtonProps) {
  if (user) {
    return (
      <button className="auth-chip" title="Click to sign out" onClick={onSignOut}>
        {user.name ?? user.email ?? "Signed in"}
      </button>
    );
  }
  return (
    <button className="btn btn-secondary" onClick={onSignIn} disabled={busy}>
      {busy ? "Signing in…" : "Sign in with Google"}
    </button>
  );
}
