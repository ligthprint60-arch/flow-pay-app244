import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWNER = "ligthprint60-arch";
const REPO = "flow-pay-app244";
const ADMIN_EMAILS = ["studioinfinit81@gmail.com"];
const GATEWAY = "https://connector-gateway.lovable.dev/github";

function assertAdmin(claims: Record<string, unknown>) {
  const email = String(claims["email"] ?? "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) throw new Error("Forbidden");
}

async function gh(path: string, init?: RequestInit) {
  const lk = process.env["LOVABLE_API_KEY"];
  const gk = process.env["GITHUB_API_KEY"];
  if (!lk || !gk) throw new Error("GitHub не подключён");
  const res = await fetch(`${GATEWAY}/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${lk}`,
      "X-Connection-Api-Key": gk,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`GitHub [${res.status}]: ${body}`);
    throw new Error(`GitHub [${res.status}]: ${body.slice(0, 300)}`);
  }
  return res.json();
}

const safePath = z
  .string()
  .min(1)
  .max(300)
  .refine((p) => !p.includes("..") && !p.startsWith("/"), "Bad path");

const b64decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
const b64encode = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export const devListFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const repo = await gh(`repos/${OWNER}/${REPO}`);
    const branch = repo.default_branch as string;
    const tree = await gh(`repos/${OWNER}/${REPO}/git/trees/${branch}?recursive=1`);
    const files = (tree.tree as { path: string; type: string }[])
      .filter((t) => t.type === "blob" && !t.path.startsWith("node_modules/"))
      .map((t) => t.path);
    return { branch, files };
  });

export const devReadFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: safePath, branch: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const f = await gh(`repos/${OWNER}/${REPO}/contents/${encodeURI(data.path)}?ref=${encodeURIComponent(data.branch)}`);
    return { content: b64decode(f.content as string), sha: f.sha as string };
  });

export const devSaveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        path: safePath,
        branch: z.string().max(100),
        content: z.string().max(1_000_000),
        sha: z.string().max(100).optional(),
        message: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const r = await gh(`repos/${OWNER}/${REPO}/contents/${encodeURI(data.path)}`, {
      method: "PUT",
      body: JSON.stringify({
        message: data.message,
        content: b64encode(data.content),
        branch: data.branch,
        ...(data.sha ? { sha: data.sha } : {}),
      }),
    });
    return { sha: r.content.sha as string, commit: r.commit.html_url as string };
  });

async function askModel(system: string, messages: { role: string; content: string }[]) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI не настроен");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions: system,
      input: messages,
      reasoning: { effort: "low" },
      store: false,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    if (res.status === 402) throw new Error("Закончились AI-кредиты рабочего пространства");
    if (res.status === 429) throw new Error("Слишком много запросов, подождите");
    throw new Error(`AI [${res.status}]: ${t.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      const p = l.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      try {
        const ev = JSON.parse(p);
        if (ev.type === "response.output_text.delta") out += ev.delta;
        if (ev.type === "error" || ev.type === "response.failed") throw new Error("AI: ошибка генерации");
      } catch (e) { if ((e as Error).message.startsWith("AI")) throw e; }
    }
  }
  return out.trim();
}

function parseJson<T>(s: string): T {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI вернул некорректный ответ");
  return JSON.parse(m[0]) as T;
}

export const devAiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      branch: z.string().max(100),
      files: z.array(z.string().max(300)).max(5000),
      openPath: z.string().max(300).nullable(),
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) })).min(1).max(20),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const tree = data.files.filter((f) => !/\.(png|jpe?g|gif|webp|ico|lock|lockb)$/i.test(f) && !f.startsWith("src/components/ui/"));
    const pick = await askModel(
      `You are a code agent for a TanStack Start + React + Tailwind v4 + Supabase app. Repository files:\n${tree.join("\n")}\n` +
        `Currently open file: ${data.openPath ?? "none"}.\nChoose up to 8 existing files you must read to fulfil the latest request. ` +
        `Reply ONLY JSON: {"read":["path",...]}`,
      data.messages,
    );
    const toRead = parseJson<{ read?: string[] }>(pick).read?.filter((p) => data.files.includes(p)).slice(0, 8) ?? [];
    const contents: string[] = [];
    for (const p of toRead) {
      try {
        const f = await gh(`repos/${OWNER}/${REPO}/contents/${encodeURI(p)}?ref=${encodeURIComponent(data.branch)}`);
        contents.push(`===== ${p} =====\n${b64decode(f.content as string).slice(0, 60000)}`);
      } catch { /* skip */ }
    }
    const answer = await askModel(
      `You are FLOW Dev AI, a code agent with full access to this repository. Files:\n${tree.join("\n")}\n\n` +
        `File contents:\n${contents.join("\n\n")}\n\n` +
        `Fulfil the user's latest request. If code changes are needed, return the COMPLETE new content of each changed or created file. ` +
        `Never edit src/integrations/supabase/*, .env or src/routeTree.gen.ts. Answer in the user's language. ` +
        `Reply ONLY JSON: {"reply":"short explanation","edits":[{"path":"...","content":"full file content"}]}`,
      data.messages,
    );
    const r = parseJson<{ reply?: string; edits?: { path: string; content: string }[] }>(answer);
    const edits = (r.edits ?? []).filter(
      (e) => typeof e.path === "string" && typeof e.content === "string" && !e.path.includes("..") &&
        !/^(src\/integrations\/supabase\/|\.env|src\/routeTree\.gen\.ts)/.test(e.path),
    );
    return { reply: r.reply ?? "", read: toRead, edits };
  });
