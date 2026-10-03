import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Code2, FileCode, Github, Save, Search, FilePlus } from "lucide-react";
import { useIsAdmin } from "@/lib/admin";
import { devListFiles, devReadFile, devSaveFile } from "@/lib/devmode.functions";

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
    </div>
  );
}
