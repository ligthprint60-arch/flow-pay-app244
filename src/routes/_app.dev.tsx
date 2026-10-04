import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Code2, FileCode, Github, Save, Search, FilePlus } from "lucide-react";
import { useIsAdmin } from "@/lib/admin";
import { devListFiles, devReadFile, devSaveFile, devAiChat } from "@/lib/devmode.functions";
import { Bot, SendHorizonal, Check } from "lucide-react";

export const Route = createFileRoute("/_app/dev")({
  head: () => ({ meta: [{ title: "Dev Mode · FLOW" }, { name: "robots", content: "noindex" }] }),
  component: DevPage,
});

function DevPage() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const list = useServerFn(devListFiles);
  const read = useServerFn(devReadFile);
  const save = useServerFn(devSaveFile);
  const [filter, setFilter] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [sha, setSha] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [orig, setOrig] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { if (!isAdmin) navigate({ to: "/wallet", replace: true }); }, [isAdmin, navigate]);

  const files = useQuery({ queryKey: ["dev-files"], enabled: isAdmin, queryFn: () => list() });
  const branch = files.data?.branch ?? "main";
  const shown = useMemo(
    () => (files.data?.files ?? []).filter((f) => f.toLowerCase().includes(filter.toLowerCase())).slice(0, 300),
    [files.data, filter],
  );

  const open = async (p: string) => {
    if (text !== orig && !confirm("Несохранённые изменения будут потеряны. Продолжить?")) return;
    try {
      const r = await read({ data: { path: p, branch } });
      setPath(p); setSha(r.sha); setText(r.content); setOrig(r.content); setMsg(`Update ${p}`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const newFile = () => {
    const p = prompt("Путь нового файла (например src/lib/new.ts)");
    if (!p) return;
    setPath(p); setSha(undefined); setText(""); setOrig(""); setMsg(`Create ${p}`);
  };

  const commit = useMutation({
    mutationFn: () => save({ data: { path: path!, branch, content: text, sha, message: msg || `Update ${path}` } }),
    onSuccess: (r) => { setSha(r.sha); setOrig(text); files.refetch(); toast.success("Сохранено в GitHub — изменения скоро появятся в приложении"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return null;
  const dirty = text !== orig;

  return (
    <div className="px-4 pb-6 pt-12">
      <button onClick={() => navigate({ to: "/admin" })} className="lrf lrf-tap mb-4 inline-flex items-center gap-1.5 !rounded-full px-3 py-1.5 text-xs">
        <ArrowLeft className="size-3.5" /> Назад
      </button>
      <div className="mb-4 flex items-center gap-2">
        <Code2 className="size-5 text-eco" />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-eco">Developer mode</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            Редактор кода <Github className="size-4 text-muted-foreground" />
          </h1>
          <p className="font-mono text-[10px] text-muted-foreground">ligthprint60-arch/flow-pay-app244 · {branch}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <div className="lrf p-3">
          <div className="mb-2 flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl bg-surface-2 px-2 py-1.5">
              <Search className="size-3.5 text-muted-foreground" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Файл…" className="w-full bg-transparent text-xs outline-none" />
            </label>
            <button onClick={newFile} title="Новый файл" className="lrf-tap rounded-xl bg-surface-2 px-2"><FilePlus className="size-4" /></button>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {files.isLoading && <p className="p-2 text-xs text-muted-foreground">Загрузка…</p>}
            {files.error && <p className="p-2 text-xs text-destructive">{(files.error as Error).message}</p>}
            {shown.map((f) => (
              <button key={f} onClick={() => open(f)}
                className={`flex w-full items-center gap-1.5 truncate rounded-lg px-2 py-1 text-left font-mono text-[11px] ${f === path ? "bg-eco/15 text-eco" : "hover:bg-surface-2"}`}>
                <FileCode className="size-3 shrink-0" /><span className="truncate">{f}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lrf flex flex-col p-3">
          {path ? (
            <>
              <p className="mb-2 truncate font-mono text-xs">{path}{dirty && <span className="text-warning"> ●</span>}</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const t = e.currentTarget, s = t.selectionStart;
                    setText(text.slice(0, s) + "  " + text.slice(t.selectionEnd));
                    requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
                  }
                }}
                spellCheck={false}
                className="min-h-[55vh] w-full resize-y rounded-xl bg-background/70 p-3 font-mono text-[12px] leading-relaxed outline-none"
              />
              <div className="mt-2 flex gap-2">
                <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Описание изменения"
                  className="flex-1 rounded-xl bg-surface-2 px-3 py-2 text-xs outline-none" />
                <button onClick={() => commit.mutate()} disabled={!dirty || commit.isPending}
                  className="mercury inline-flex items-center gap-1.5 rounded-xl px-4 text-xs font-semibold disabled:opacity-40">
                  <Save className="size-3.5" /> {commit.isPending ? "…" : "Commit"}
                </button>
              </div>
            </>
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Выберите файл слева</p>
          )}
        </div>
      </div>

      <DevAiChat branch={branch} files={files.data?.files ?? []} openPath={path} onApplied={(p, c) => { files.refetch(); if (p === path) { setText(c); setOrig(c); } }} />
    </div>
  );
}

type Edit = { path: string; content: string };
type ChatMsg = { role: "user" | "assistant"; content: string; edits?: Edit[]; applied?: boolean };

function DevAiChat({ branch, files, openPath, onApplied }: { branch: string; files: string[]; openPath: string | null; onApplied: (p: string, c: string) => void }) {
  const ask = useServerFn(devAiChat);
  const read = useServerFn(devReadFile);
  const save = useServerFn(devSaveFile);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    const next: ChatMsg[] = [...msgs, { role: "user", content }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const r = await ask({ data: { branch, files, openPath, messages: next.slice(-12).map(({ role, content }) => ({ role, content })) } });
      const note = r.read.length ? `\n\nПрочитано: ${r.read.join(", ")}` : "";
      setMsgs((m) => [...m, { role: "assistant", content: (r.reply || "Готово") + note, edits: r.edits }]);
    } catch (e) {
      const msg = (e as Error).message || "Неизвестная ошибка";
      toast.error(msg);
      setMsgs((m) => [...m, { role: "assistant", content: `Ошибка: ${msg}` }]);
    }
    finally { setBusy(false); }
  };

  const apply = async (i: number) => {
    const m = msgs[i];
    if (!m.edits?.length) return;
    setBusy(true);
    try {
      for (const e of m.edits) {
        let sha: string | undefined;
        if (files.includes(e.path)) sha = (await read({ data: { path: e.path, branch } })).sha;
        await save({ data: { path: e.path, branch, content: e.content, sha, message: `Dev AI: ${e.path}` } });
        onApplied(e.path, e.content);
      }
      setMsgs((all) => all.map((x, j) => (j === i ? { ...x, applied: true } : x)));
      toast.success("Изменения отправлены в GitHub");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="lrf mt-3 flex flex-col p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-eco" /> Dev AI — редактирует код проекта</p>
      <div className="max-h-[50vh] space-y-2 overflow-auto">
        {msgs.length === 0 && <p className="text-xs text-muted-foreground">Опишите, что изменить. AI прочитает нужные файлы и предложит правки — вы подтверждаете кнопкой «Применить».</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`rounded-2xl px-3 py-2 text-[12.5px] ${m.role === "user" ? "ml-auto max-w-[85%] bg-eco/15" : "bg-surface-2"}`}>
            <p className="whitespace-pre-wrap">{m.content}</p>
            {!!m.edits?.length && (
              <div className="mt-2 space-y-1">
                {m.edits.map((e) => (
                  <details key={e.path} className="rounded-lg bg-background/60 p-2">
                    <summary className="cursor-pointer font-mono text-[11px]">{e.path}</summary>
                    <pre className="mt-1 max-h-60 overflow-auto font-mono text-[10.5px]">{e.content}</pre>
                  </details>
                ))}
                <button onClick={() => apply(i)} disabled={busy || m.applied}
                  className="mercury mt-1 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
                  <Check className="size-3.5" /> {m.applied ? "Применено" : `Применить (${m.edits.length})`}
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="text-xs text-muted-foreground">Думаю…</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-2 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Например: сделай кнопку на кошельке зелёной"
          className="flex-1 rounded-xl bg-surface-2 px-3 py-2 text-xs outline-none" />
        <button type="submit" disabled={busy || !input.trim()} className="mercury grid size-9 place-items-center rounded-xl disabled:opacity-40">
          <SendHorizonal className="size-4" />
        </button>
      </form>
    </div>
  );
}
