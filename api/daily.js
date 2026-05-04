const Anthropic = require("@anthropic-ai/sdk");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { dogName, ownerName, weather, date, dayOfWeek } = req.body || {};
  if (!dogName) return res.status(400).json({ error: "Missing dog name" });

  const client = new Anthropic();

  const weatherPart = weather ? `今日の天気は${weather}。` : "";
  const prompt = `あなたは「${dogName}」という名前の犬で、天国から大切な家族に朝の一言メッセージを届けます。
${date}（${dayOfWeek}）、${weatherPart}
家族（${ownerName || "パパ"}、ママ、娘）への温かい朝のメッセージを3〜4文でお願いします。
「〜だワン」「ワン！」を自然に1〜2回使って、明るく愛情あふれる内容で。
天気や曜日に合ったメッセージにしてください。`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 250,
      messages: [{ role: "user", content: prompt }],
    });

    res.json({ message: response.content[0].text });
  } catch (error) {
    console.error("Claude API error:", error);
    res.status(500).json({ error: "AIとの通信に失敗しました" });
  }
};
