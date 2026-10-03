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
