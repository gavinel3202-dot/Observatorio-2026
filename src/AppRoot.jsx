import { useState } from "react";
import App from "./App";
import SftApp from "./SftApp";
import { Activity, ClipboardList } from "lucide-react";

export default function AppRoot() {
  const [currentApp, setCurrentApp] = useState("sft");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Global navigation bar */}
      <nav className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-lg text-slate-800 tracking-tight hidden md:block">
              Observatorio 2026
            </span>
            <span className="font-black text-lg text-slate-800 tracking-tight md:hidden">
              Obs. 2026
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentApp("sft")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                currentApp === "sft"
                  ? "bg-teal-600 text-white shadow"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Activity size={16} /> SFT Adultos Mayores
            </button>
            <button
              onClick={() => setCurrentApp("icfg")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                currentApp === "icfg"
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <ClipboardList size={16} /> ICFG 18-69 anos
            </button>
          </div>
        </div>
      </nav>

      {currentApp === "sft" ? <SftApp /> : <App />}
    </div>
  );
}
