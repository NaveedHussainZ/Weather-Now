import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  WiDaySunny,
  WiCloud,
  WiRain,
  WiSnow,
  WiStrongWind,
  WiFog,
  WiThunderstorm,
  WiNightClear,
} from "react-icons/wi";
import { HiLocationMarker, HiSearch, HiShare } from "react-icons/hi";

const cx = (...arr) => arr.filter(Boolean).join(" ");

/** Map Open-Meteo weather codes to an icon + label. */
function iconFor(code = 0, isDay = 1, size = 72) {
  const commonProps = { size };
  if (code === 0)
    return isDay ? (
      <WiDaySunny {...commonProps} className="text-yellow-400" />
    ) : (
      <WiNightClear {...commonProps} className="text-indigo-300" />
    );
  if ([1, 2, 3].includes(code))
    return <WiCloud {...commonProps} className="text-sky-400" />;
  if ([45, 48].includes(code))
    return <WiFog {...commonProps} className="text-slate-400" />;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return <WiRain {...commonProps} className="text-blue-500" />;
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return <WiSnow {...commonProps} className="text-cyan-300" />;
  if ([95, 96, 99].includes(code))
    return <WiThunderstorm {...commonProps} className="text-purple-400" />;
  return <WiStrongWind {...commonProps} className="text-teal-400" />;
}

/** Map weather codes to readable text */
function labelFor(code = 0) {
  if (code === 0) return "Clear sky";
  if ([1].includes(code)) return "Mainly clear";
  if ([2].includes(code)) return "Partly cloudy";
  if ([3].includes(code)) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([56, 57].includes(code)) return "Freezing drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing rain";
  if ([71, 73, 75].includes(code)) return "Snowfall";
  if ([77].includes(code)) return "Snow grains";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95].includes(code)) return "Thunderstorm";
  if ([96, 99].includes(code)) return "Thunderstorm with hail";
  return "Unknown";
}

/** Format a nice location label from geocoding result */
function formatLocationLabel(r) {
  if (!r) return "Unknown location";
  const parts = [r.name];
  if (r.admin1 && r.admin1 !== r.name) parts.push(r.admin1);
  if (r.country) parts.push(r.country);
  return parts.filter(Boolean).join(",\n");
}

export default function WeatherCard({ theme = "light", onMetaChange }) {
  const [query, setQuery] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [unit, setUnit] = useState("celsius");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [coords, setCoords] = useState(null);
  const [data, setData] = useState(null);
  const [dailyForecast, setDailyForecast] = useState(null);
  const [shareMessage, setShareMessage] = useState(""); // ✅ for copy feedback
  const lastFetchRef = useRef({ lat: null, lon: null, unit: null });

  const cardClass = useMemo(
    () =>
      cx(
        "w-full mx-auto max-w-3xl rounded-2xl shadow-xl p-5 sm:p-6 md:p-8 transition-colors",
        "backdrop-blur-md border",
        theme === "dark"
          ? "bg-white/10 border-white/15"
          : "bg-black/30 border-white/30"
      ),
    [theme]
  );

  const fetchWeatherAt = useCallback(
    async ({ lat, lon, unitToUse = unit, placeLabel = null }) => {
      if (
        lastFetchRef.current.lat === lat &&
        lastFetchRef.current.lon === lon &&
        lastFetchRef.current.unit === unitToUse
      ) {
        return;
      }

      setLoading(true);
      setError("");
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&temperature_unit=${unitToUse}&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Weather request failed");
        const json = await res.json();

        if (!json.current_weather)
          throw new Error("No current weather available");

        const cw = json.current_weather;
        setData(cw);
        setDailyForecast(json.daily);

        onMetaChange?.({ code: cw.weathercode, isDay: cw.is_day });

        if (placeLabel) setDisplayName(placeLabel);

        lastFetchRef.current = { lat, lon, unit: unitToUse };
      } catch (e) {
        console.error(e);
        setError("Failed to fetch weather. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [onMetaChange, unit]
  );

  const resolveCity = useCallback(async (name) => {
    const geoURL = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=1&language=en`;
    const res = await fetch(geoURL);
    if (!res.ok) throw new Error("Geocoding request failed");
    const j = await res.json();
    if (!j.results || j.results.length === 0) throw new Error("City not found");
    const r = j.results[0];
    return {
      lat: r.latitude,
      lon: r.longitude,
      label: formatLocationLabel(r),
    };
  }, []);

  const reverseLabel = useCallback(async (lat, lon) => {
    try {
      const revURL = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&count=1`;
      const res = await fetch(revURL);
      if (!res.ok) return null;
      const j = await res.json();
      if (!j.results || j.results.length === 0) return null;
      return formatLocationLabel(j.results[0]);
    } catch {
      return null;
    }
  }, []);

  // On load → detect location & fetch
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCoords({ lat, lon });

        const place = await reverseLabel(lat, lon);
        const label = place || "Live location";
        setDisplayName(label);

        fetchWeatherAt({ lat, lon, unitToUse: unit, placeLabel: label });
      },
      () => setError("Could not get your location."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [fetchWeatherAt, reverseLabel, unit]);

  useEffect(() => {
    if (coords) {
      fetchWeatherAt({ lat: coords.lat, lon: coords.lon, unitToUse: unit });
    }
  }, [unit, coords, fetchWeatherAt]);

  const onSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { lat, lon, label } = await resolveCity(query.trim());
      setCoords({ lat, lon });
      setDisplayName(label);
      await fetchWeatherAt({ lat, lon, unitToUse: unit, placeLabel: label });
    } catch (e) {
      console.error(e);
      setError(
        e?.message === "City not found"
          ? "City not found. Try another name."
          : "Could not find that place. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ Share weather link
  const handleShare = async () => {
    if (!displayName) return;
    const city = displayName.split(",")[0]; // just take city name
    const shareUrl = `${window.location.origin}/weather/${encodeURIComponent(
      city
    )}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("✅ Weather link copied!");
      setTimeout(() => setShareMessage(""), 3000);
    } catch {
      setShareMessage("❌ Failed to copy link");
      setTimeout(() => setShareMessage(""), 3000);
    }
  };

  const Loader = () => (
    <div className="flex items-center justify-center gap-3 py-6">
      <svg
        className="animate-spin h-5 w-5"
        viewBox="0 0 24 24"
        role="status"
        aria-label="Loading"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"
        ></path>
      </svg>
      <span className="font-medium">Loading…</span>
    </div>
  );

  const unitLabel = unit === "celsius" ? "°C" : "°F";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cardClass}
    >
      {/* Search & Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <HiSearch
            className={cx(
              "absolute left-3 top-1/2 -translate-y-1/2",
              theme === "dark" ? "text-slate-300" : "text-slate-500"
            )}
            size={18}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Search city (e.g., Chennai, London)"
            className={cx(
              "w-full pl-9 pr-3 py-3 rounded-xl outline-none border",
              "transition",
              theme === "dark"
                ? "bg-slate-800/60 border-slate-600 text-slate-100 placeholder:text-slate-400"
                : "bg-white/70 border-slate-300 text-slate-900 placeholder:text-slate-500"
            )}
          />
        </div>

        {/* Search button */}
        <button
          onClick={onSearch}
          disabled={loading}
          className={cx(
            "px-4 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 transition cursor-pointer",
            loading ? "opacity-70" : "hover:scale-[1.02]",
            theme === "dark"
              ? "bg-indigo-600 text-white"
              : "bg-sky-600 text-white"
          )}
        >
          <HiLocationMarker size={18} />
          {loading ? "Searching…" : "Search"}
        </button>

        {/* Unit toggle */}
        <button
          onClick={() =>
            setUnit((u) => (u === "celsius" ? "fahrenheit" : "celsius"))
          }
          className={cx(
            "px-4 py-3 rounded-xl font-semibold transition cursor-zoom-in",
            theme === "dark"
              ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
              : "bg-slate-200 text-slate-900 hover:bg-slate-300"
          )}
          title="Toggle temperature unit"
        >
          Toggle °C / °F
        </button>

        {/* ✅ Share button */}
        <button
          onClick={handleShare}
          className={cx(
            "px-4 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 transition cursor-pointer",
            theme === "dark"
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          )}
        >
          <HiShare size={18} />
          Share
        </button>
      </div>

      {/* Share message */}
      {shareMessage && (
        <div
          className={cx(
            "mt-3 px-4 py-2 rounded-xl text-sm font-medium text-center",
            theme === "dark"
              ? "bg-emerald-900/40 text-emerald-200"
              : "bg-emerald-100 text-emerald-700"
          )}
        >
          {shareMessage}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className={cx(
            "mt-4 px-4 py-3 rounded-xl font-medium",
            theme === "dark"
              ? "bg-rose-900/30 text-rose-200"
              : "bg-rose-100 text-rose-700"
          )}
        >
          {error}
        </div>
      )}
      {loading && <Loader />}

      {/* Current weather */}
      {data && !loading && (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className={cx(
              "mt-5 p-5 sm:p-6 md:p-8 rounded-2xl border",
              theme === "dark"
                ? "bg-black/20 border-white/10"
                : "bg-white/60 border-white/40",
              "grid grid-cols-1 md:grid-cols-3 gap-5"
            )}
          >
            <div className="flex flex-col items-center justify-center text-center gap-3">
              {iconFor(data.weathercode, data.is_day, 88)}
              <div className="text-5xl font-extrabold tabular-nums">
                {Math.round(data.temperature)}
                {unitLabel}
              </div>
              <div
                className={cx(
                  "text-sm",
                  theme === "dark" ? "text-slate-300" : "text-slate-600"
                )}
              >
                Feels like ~{Math.round(data.temperature)}
                {unitLabel}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center text-center gap-1 whitespace-pre-line">
              <div className="text-lg font-semibold">{displayName || "—"}</div>
              <div
                className={cx(
                  "text-sm",
                  theme === "dark" ? "text-slate-300" : "text-slate-600"
                )}
              >
                {data.time
                  ? new Date(data.time).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : ""}
              </div>
              <div
                className={cx(
                  "text-xs",
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                )}
              >
                {labelFor(data.weathercode)} • {data.is_day ? "Day" : "Night"}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-2">
              <div className="text-sm">
                <span className="opacity-70">Wind:</span>{" "}
                <span className="font-semibold">
                  {Math.round(data.windspeed)} km/h
                </span>
              </div>
              {typeof data.winddirection === "number" && (
                <div className="text-sm">
                  <span className="opacity-70">Wind Dir:</span>{" "}
                  <span className="font-semibold">
                    {Math.round(data.winddirection)}°
                  </span>
                </div>
              )}
              {dailyForecast && (
                <div className="text-sm">
                  <span className="opacity-70">Sunrise:</span>{" "}
                  {new Date(dailyForecast.sunrise[0]).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  <br />
                  <span className="opacity-70">Sunset:</span>{" "}
                  {new Date(dailyForecast.sunset[0]).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* 7-day forecast */}
          {dailyForecast && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mt-6">
              {dailyForecast.time.map((date, index) => (
                <div
                  key={date}
                  className={cx(
                    "p-3 rounded-xl backdrop-blur-md text-center shadow-sm border",
                    theme === "dark"
                      ? "bg-white/10 border-white/15 text-slate-200"
                      : "bg-white/70 border-slate-200 text-slate-800"
                  )}
                >
                  <p className="text-sm font-medium">
                    {new Date(date).toLocaleDateString("en-GB", {
                      weekday: "short",
                    })}
                  </p>
                  <div className="flex justify-center my-1">
                    {iconFor(dailyForecast.weathercode[index], 1, 36)}
                  </div>
                  <p className="text-xs opacity-70">
                    {new Date(date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                  <p className="text-md font-bold mt-1">
                    {Math.round(dailyForecast.temperature_2m_max[index])}° /{" "}
                    {Math.round(dailyForecast.temperature_2m_min[index])}°
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <p
          className={cx(
            "mt-5 text-center",
            theme === "dark" ? "text-slate-300" : "text-slate-600"
          )}
        >
          Tip: Allow location access or search a city to see current conditions.
        </p>
      )}
    </motion.section>
  );
}
