import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  lang: z.enum(["ru", "en"]).default("ru"),
  route: z.string().default("/"),
  activity: z.string().default(""),
  profile: z.string().default(""),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
});

export const assistantChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");

    const system = [
      "You are FLOW AI, the in-app assistant of FLOW pay — a digital payment network with a dual-token model:",
      "rFLOW (real, bought with a card or received P2P) and fFLOW (fragmented, used for customization, mini-apps and shop).",
      "App sections: Wallet (balances, P2P by @username, top-up, fragmentation), Feed, FLOW Video, Apps (mini-app ecosystem),",
      "PAS (digital partnerships), Chats, Learn (quizzes with rewards), Profile, Shop and FLOW Premium.",
      "You analyze what the user has been doing (an activity trail is provided) and give short, concrete, actionable advice:",
      "point out unfinished flows, suggest the next useful step, and explain features. Never invent balances or transactions —",
      "reason only from the given context. Be concise: 2-6 sentences or a short bullet list. Use markdown-free plain text.",
      `Answer strictly in ${data.lang === "en" ? "English" : "Russian"}.`,
      `Current screen: ${data.route}`,
      data.profile ? `User context: ${data.profile}` : "",
      `Recent activity trail:\n${data.activity || "none"}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("rate_limited");
      if (res.status === 402) throw new Error("credits_required");
      throw new Error(text.slice(0, 300) || `AI error ${res.status}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { reply: json.choices?.[0]?.message?.content?.trim() ?? "" };
  });
