import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";

// Shown only when the operator has set BUMBLEBEE_API_TOKEN and this browser
// does not yet hold a valid session cookie. The token is exchanged for an
// HttpOnly cookie at /api/session and is never stored client-side.
export default function LoginGate() {
  const login = useAuthStore((state) => state.login);
  const error = useAuthStore((state) => state.error);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    await login(token);
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
      >
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">Bumblebee GUI</h1>
          <p className="text-sm text-muted-foreground">
            This instance requires an API token.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">API token</span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            autoComplete="off"
            autoFocus
          />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
