import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import Results from "./pages/Results";
import Findings from "./pages/Findings";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import LoginGate from "./components/LoginGate";
import { useAuthStore } from "./stores/authStore";

function requiresLogin(authRequired: boolean, authenticated: boolean): boolean {
  if (!authRequired) return false;
  return !authenticated;
}

function App() {
  const checked = useAuthStore((state) => state.checked);
  const authRequired = useAuthStore((state) => state.authRequired);
  const authenticated = useAuthStore((state) => state.authenticated);
  const check = useAuthStore((state) => state.check);

  useEffect(() => {
    check();
  }, [check]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (requiresLogin(authRequired, authenticated)) {
    return <LoginGate />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/results" element={<Results />} />
        <Route path="/results/:scanId" element={<Results />} />
        <Route path="/findings" element={<Findings />} />
        <Route path="/findings/:scanId" element={<Findings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
