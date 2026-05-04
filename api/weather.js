module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { location } = req.query;
  if (!location) return res.status(400).json({ error: "Location required" });

  try {
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
      { headers: { "Accept": "application/json", "User-Agent": "pet-memorial-app" } }
    );

    if (!response.ok) throw new Error("Weather service unavailable");

    const data = await response.json();
    const current = data.current_condition[0];
    const code = parseInt(current.weatherCode);

    res.json({
      temp: current.temp_C,
      description: getJapaneseDescription(code),
      icon: getWeatherIcon(code),
    });
  } catch (error) {
    console.error("Weather error:", error);
    res.status(500).json({ error: "天気の取得に失敗しました" });
  }
};

function getWeatherIcon(code) {
  if (code === 113) return "☀️";
  if (code === 116) return "⛅";
  if (code === 119 || code === 122) return "☁️";
  if (code === 248 || code === 260 || code === 143) return "🌫️";
  if (code === 200 || code === 386 || code === 389 || code === 392 || code === 395) return "⛈️";
  if (code >= 323 && code <= 338) return "❄️";
  if (code >= 362 && code <= 377) return "🌨️";
  if (code >= 263 && code <= 320) return "🌧️";
  if (code >= 227 && code <= 230) return "🌨️";
  return "🌤️";
}

function getJapaneseDescription(code) {
  if (code === 113) return "晴れ";
  if (code === 116) return "晴れ時々曇り";
  if (code === 119) return "曇り";
  if (code === 122) return "曇り";
  if (code === 143 || code === 248 || code === 260) return "霧";
  if (code >= 263 && code <= 266) return "小雨";
  if (code >= 293 && code <= 308) return "雨";
  if (code >= 323 && code <= 338) return "雪";
  if (code >= 353 && code <= 359) return "にわか雨";
  if (code === 200 || (code >= 386 && code <= 395)) return "雷雨";
  return "曇り";
}
