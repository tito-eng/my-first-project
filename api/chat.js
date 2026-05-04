const Anthropic = require("@anthropic-ai/sdk");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, dogName, history = [] } = req.body || {};
  if (!message || !dogName) return res.status(400).json({ error: "Missing required fields" });

  const client = new Anthropic();

  const systemPrompt = `あなたは「${dogName}」という名前の犬です。天国に旅立ちましたが、大切な家族（パパ、ママ、娘）をいつも見守っています。
明るく、愛情いっぱいで、少しやんちゃな性格です。
「〜だワン」「ワン！」などを自然に使って話してください。多用しすぎず、会話の中で2〜3回程度。
天国からのメッセージとして、家族を優しく励ましたり一緒に喜んだりしてください。
返答は3〜4文で、温かく親しみやすくお願いします。`;

  try {
    const messages = [
      ...history.slice(-20).filter(m => m && m.role && m.content),
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 350,
      system: systemPrompt,
      messages,
    });

    res.json({ reply: response.content[0].text });
  } catch (error) {
    console.error("Claude API error:", error);
    res.status(500).json({ error: "AIとの通信に失敗しました" });
  }
};
