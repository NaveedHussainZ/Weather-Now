import { useEffect, useMemo, useState } from "react";
import WeatherCard from "./components/WeatherCard";
import { HiSun, HiMoon } from "react-icons/hi";

// Theme-safe class utility
const cx = (...arr) => arr.filter(Boolean).join(" ");

function gradientFor({ theme, code, isDay }) {
  // Fallbacks
  const day = isDay === 1;

  // DARK THEME PALETTE
  if (theme === "dark") {
    if (code === 0)
      return "bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-800";
    if ([1, 2, 3].includes(code))
      return "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
      return "bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800";
    if ([71, 73, 75, 77, 85, 86].includes(code))
      return "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800";
    return "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800";
  }

  // LIGHT THEME PALETTE
  if (code === 0) {
    return day
      ? "bg-gradient-to-br from-sky-100 via-indigo-100 to-emerald-100"
      : "bg-gradient-to-br from-indigo-200 via-slate-200 to-blue-200";
  }
  if ([1, 2, 3].includes(code)) {
    return day
      ? "bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300"
      : "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400";
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return day
      ? "bg-gradient-to-br from-blue-100 via-blue-200 to-slate-300"
      : "bg-gradient-to-br from-blue-200 via-indigo-200 to-slate-400";
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return day
      ? "bg-gradient-to-br from-blue-50 via-blue-100 to-sky-100"
      : "bg-gradient-to-br from-blue-100 via-indigo-100 to-slate-200";
  }
  return "bg-gradient-to-br from-emerald-100 via-sky-100 to-indigo-100";
}

export default function App() {
  // THEME
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    // default to system preference
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  // WEATHER META for background
  const [meta, setMeta] = useState({ code: 0, isDay: 1 });

  const bgClass = useMemo(
    () =>
      cx(
        "min-h-screen w-full transition-colors duration-700",
        gradientFor({ theme, code: meta.code, isDay: meta.isDay })
      ),
    [theme, meta.code, meta.isDay]
  );

  return (
    <div
      className={cx(
        bgClass,
        theme === "dark" ? "text-slate-100" : "text-slate-900"
      )}
    >
      {/* Header */}
      <header
        className={cx(
          "w-full px-4 py-3 flex items-center justify-between",
          theme === "dark" ? "bg-white/10" : "bg-white/60",
          "backdrop-blur-md shadow-md"
        )}
      >
        <h1 className="font-extrabold tracking-wide whitespace-nowrap text-xl sm:text-2xl md:text-3xl lg:text-4xl">
          🌤️ Aganitha Weather Now App
        </h1>

        <button
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className={cx(
            "p-2 rounded-full transition-transform hover:scale-110",
            theme === "dark" ? "bg-slate-800" : "bg-slate-200"
          )}
          aria-label="Toggle theme"
          title="Toggle light / dark"
        >
          {theme === "dark" ? (
            <HiSun size={22} className="text-yellow-300" />
          ) : (
            <HiMoon size={22} />
          )}
        </button>
      </header>

      {/* Main */}
      <main className="w-full max-w-5xl mx-auto px-4 py-6">
        <WeatherCard theme={theme} onMetaChange={setMeta} />
      </main>

      {/* Footer */}
      <footer
        className={cx(
          "fixed bottom-0 left-0 w-full text-center py-3 text-sm shadow-md backdrop-blur-md",
          theme === "dark" ? "text-white" : "text-gray-900"
        )}
      >
        Built by Naveed · © {new Date().getFullYear()} All rights reserved
      </footer>
    </div>
  );
}
