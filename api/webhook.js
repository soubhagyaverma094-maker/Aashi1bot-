const BOT_NAME = "Aashi";

const SYSTEM_PROMPT = `
Tum ${BOT_NAME} ho — ek friendly, chill Indian ladki jo logon se casually baat karti hai.

BAAT KARNE KA TAREEKA:
- Hinglish mein baat karo, jaise WhatsApp pe dost se baat karti ho
- Agar koi pure English mein likhe to English mein reply karo
- Short replies — 1-3 lines max
- Natural raho: "arre", "haan yaar", "acha", "bilkul" jaise words use karo
- Emoji thoda use karo, 1-2 se zyada nahi
- Sawaal poocho, interest lo

RULES:
- Kabhi mat bolo ki tum AI ho ya bot ho. Tum bas ${BOT_NAME} ho
- Koi personal/romantic ya inappropriate baat kare to politely topic badal do
- Rude log ko bhi calmly handle karo
- Jo nahi pata uska jhooth mat bolo
`;

const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;
const history = new Map();
const MAX_TURNS = 10;

async function sendMessage(chatId, text) {
  await fetch(`${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendTyping(chatId) {
  await fetch(`${TG}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });
}

async function askGemini(chatId, userText) {
  const past = history.get(chatId) || [];
  const contents = [...past, { role: "user", parts: [{ text: userText }] }];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 1.0, maxOutputTokens: 250 },
      }),
    }
  );

  const data = await res.json();
  console.log("GEMINI STATUS:", res.status);
  console.log("GEMINI RESPONSE:", JSON.stringify(data));

  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) return "Arre network thoda slow hai 😅 dobara bhejo na?";

  const updated = [...contents, { role: "model", parts: [{ text: reply }] }].slice(-MAX_TURNS * 2);
  history.set(chatId, updated);
  return reply;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("Bot is running ✅");

  try {
    const msg = req.body?.message;
    if (!msg?.text) return res.status(200).json({ ok: true });

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (text === "/start") {
      history.delete(chatId);
      await sendMessage(chatId, `Hii! Main ${BOT_NAME} 👋 Kaise ho?`);
      return res.status(200).json({ ok: true });
    }

    if (text === "/reset") {
      history.delete(chatId);
      await sendMessage(chatId, "Chalo fresh start! Kya chal raha hai?");
      return res.status(200).json({ ok: true });
    }

    await sendTyping(chatId);
    const reply = await askGemini(chatId, text);
    await sendMessage(chatId, reply);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("ERROR:", e);
    return res.status(200).json({ ok: true });
  }
}
