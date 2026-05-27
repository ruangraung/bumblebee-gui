import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import Results from "./pages/Results";
import Findings from "./pages/Findings";
import Settings from "./pages/Settings";

function App() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar placeholder — will be implemented later */}
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/results" element={<Results />} />
          <Route path="/findings" element={<Findings />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
