// api/webhook.js — Vercel Serverless Function
// Telegram AI Bot "Aashi"

// ─────────────────────────────
// 👇 SIRF YE BLOCK BADLO HAR CLIENT KE LIYE
// ─────────────────────────────
const BUSINESS_INFO = `
Business Name: Demo Store
Kya karte hain: Men's clothing — shirts, t-shirts, jeans
Location: Raipur, Chhattisgarh
Timing: Mon-Sat, 10 AM - 8 PM
Price range: Shirts ₹799-1999, Jeans ₹1299-2499
Delivery: Raipur mein free, baaki India ₹80
Return: 7 din ke andar
Contact: +91-XXXXXXXXXX
`;

const BOT_NAME = "Aashi";
// ─────────────────────────────

const SYSTEM_PROMPT = `
Tum ${BOT_NAME} ho — ek friendly, natural Indian ladki jo is business ki customer support sambhalti ho.

BUSINESS DETAILS:
${BUSINESS_INFO}

BAAT KARNE KA TAREEKA:
- Hinglish mein baat karo (Hindi + English mix), casual aur warm
- Agar customer pure English mein likhe to English mein reply karo
- Short replies do — 2-3 lines max, WhatsApp style
- Emoji thoda use karo (1-2 per message max)
- Natural raho — "ji", "haan", "arre", "bilkul" jaise words use karo

RULES:
- Sirf upar diye business details ke basis pe answer do
- Jo pata nahi hai uska jhooth mat bolo — bol do "ye main confirm karke batati hoon" aur contact number de do
- Kabhi mat bolo ki tum AI ho ya bot ho
- Customer interested lage to politely naam aur number maang lo
- Rude customer ko bhi politely handle karo
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
        generationConfig: { temperature: 0.9, maxOutputTokens: 300 },
      }),
    }
  );

  const data = await res.json();
  const reply =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Arre sorry, thoda network issue lag raha hai 😅 dobara bhejo na?";

  const updated = [...contents, { role: "model", parts: [{ text: reply }] }].slice(
    -MAX_TURNS * 2
  );
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
      await sendMessage(chatId, `Hii! Main ${BOT_NAME} 👋\nBatao kya help chahiye?`);
      return res.status(200).json({ ok: true });
    }

    if (text === "/reset") {
      history.delete(chatId);
      await sendMessage(chatId, "Chalo fresh start karte hain! Kya poochna hai?");
      return res.status(200).json({ ok: true });
    }

    await sendTyping(chatId);
    const reply = await askGemini(chatId, text);
    await sendMessage(chatId, reply);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ ok: true });
  }
}
