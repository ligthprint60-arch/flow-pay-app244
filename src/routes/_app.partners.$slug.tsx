import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Users, Heart, Plus, Wallet, FileText, ListTodo, ScrollText,
  ShieldCheck, Check, XCircle, Trash2, Handshake,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { fmt } from "@/lib/format";

export const Route = createFileRoute("/_app/partners/$slug")({
  head: () => ({
    meta: [
      { title: "Партнёрство — FLOW PAS" },
      { name: "description", content: "Публичная страница и панель управления цифрового партнёрства FLOW PAS." },
      { property: "og:title", content: "Партнёрство — FLOW PAS" },
      { property: "og:description", content: "Участники, проекты, документы, финансы и репутация партнёрства." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnerPage,
});

type Tab = "public" | "members" | "work" | "finance" | "docs" | "log";

function PartnerPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("public");

  const { data: p, isLoading } = useQuery({
    queryKey: ["partnership", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("partnerships").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const pid = p?.id;

  const { data: members } = useQuery({
    queryKey: ["p-members", pid],
    enabled: !!pid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partnership_members")
        .select("id, user_id, role, share, status, profiles:user_id(username, display_name, avatar_url)")
        .eq("partnership_id", pid!);
      if (error) throw error;
      return data as unknown as Array<{
        id: string; user_id: string; role: string; share: number; status: string;
        profiles: { username: string; display_name: string; avatar_url: string | null } | null;
      }>;
    },
  });

  const me = members?.find((m) => m.user_id === user?.id);
  const isMember = !!me && me.status === "active";
  const isAdmin = isMember && (me!.role === "founder" || me!.role === "admin");

  const { data: following } = useQuery({
    queryKey: ["p-follow", pid, user?.id],
    enabled: !!pid && !!user,
    queryFn: async () => {
      const { count } = await supabase.from("partnership_followers").select("*", { count: "exact", head: true })
        .eq("partnership_id", pid!).eq("user_id", user!.id);
      return (count ?? 0) > 0;
    },
  });

  const follow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("app_toggle_follow_partnership", { p_id: pid! });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["p-follow", pid] });
      qc.invalidateQueries({ queryKey: ["partnership", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const join = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("app_join_partnership", { p_id: pid!, p_message: undefined });
      if (error) throw error;
      return data as { joined?: boolean; requested?: boolean };
    },
    onSuccess: (r) => {
      toast.success(r?.requested ? "Заявка отправлена" : "Вы присоединились");
      qc.invalidateQueries({ queryKey: ["p-members", pid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="px-5 pt-16"><div className="h-40 animate-pulse rounded-3xl bg-white/[0.04]" /></div>;
  if (!p) return (
    <div className="px-5 pt-20 text-center">
      <p className="text-sm text-muted-foreground">Партнёрство не найдено.</p>
      <Link to="/partners" className="mt-3 inline-block text-xs text-eco">К списку</Link>
    </div>
  );

  const tabs: Array<[Tab, string]> = [
    ["public", "Страница"], ["members", "Участники"], ["work", "Работа"],
    ...(isMember ? ([["finance", "Финансы"], ["docs", "Документы"], ["log", "Журнал"]] as Array<[Tab, string]>) : []),
  ];

  return (
    <div className="px-5 pb-6 pt-12">
      <Link to="/partners" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="size-3.5" /> Партнёрства
      </Link>

      <div className="lrf lrf-thick mb-4 p-4">
        <div className="flex items-center gap-3">
          {p.logo_url
            ? <img src={p.logo_url} alt={`Логотип ${p.name}`} className="size-14 rounded-2xl object-cover" />
            : <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-eco/40 to-fiat/25 text-base font-bold">{p.name.slice(0, 2).toUpperCase()}</div>}
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 truncate text-lg font-bold">
              {p.name}{!p.is_open && <ShieldCheck className="size-3.5 text-muted-foreground" />}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {p.field} · с {new Date(p.founded_at).toLocaleDateString("ru-RU")}
            </p>
          </div>
        </div>
        {p.description && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{p.description}</p>}
        {p.goals && <p className="mt-2 text-xs leading-relaxed"><span className="text-muted-foreground">Цели: </span>{p.goals}</p>}

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Участники" value={members?.length ?? 0} />
          <Stat label="Подписчики" value={p.followers_count} />
          <Stat label="Репутация" value={p.reputation} />
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={() => follow.mutate()}
            className={`h-10 flex-1 rounded-2xl text-xs font-semibold ${following ? "lrf" : "mercury"}`}>
            <span className="inline-flex items-center gap-1.5"><Heart className={`size-3.5 ${following ? "fill-current text-eco" : ""}`} />{following ? "Вы подписаны" : "Подписаться"}</span>
          </button>
          {!isMember && (
            <button onClick={() => join.mutate()} disabled={join.isPending}
              className="lrf h-10 flex-1 rounded-2xl text-xs font-semibold">
              {p.is_open ? "Вступить" : "Подать заявку"}
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${tab === t ? "bg-eco/30 text-foreground emissive-eco" : "bg-white/[0.05] text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "public" && <PostsTab pid={p.id} canPost={isMember} />}
      {tab === "members" && <MembersTab pid={p.id} isAdmin={isAdmin} members={members ?? []} />}
      {tab === "work" && <WorkTab pid={p.id} isMember={isMember} />}
      {tab === "finance" && isMember && <FinanceTab pid={p.id} canEdit={isMember} />}
      {tab === "docs" && isMember && <DocsTab pid={p.id} />}
      {tab === "log" && isMember && <LogTab pid={p.id} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] py-2">
      <p className="text-sm font-bold">{fmt(value)}</p>
      <p className="text-[9.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="acrylic p-8 text-center">
      <Icon className="mx-auto mb-2 size-5 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

/* ---------- POSTS ---------- */
function PostsTab({ pid, canPost }: { pid: string; canPost: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [body, setBody] = useState("");

  const { data: posts } = useQuery({
    queryKey: ["p-posts", pid],
    queryFn: async () => {
      const { data, error } = await supabase.from("partnership_posts")
        .select("*").eq("partnership_id", pid).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("partnership_posts")
        .insert({ partnership_id: pid, author_id: user!.id, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["p-posts", pid] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      {canPost && (
        <div className="lrf p-3">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2}
            placeholder="Новость партнёрства…"
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
          <button disabled={!body.trim() || add.isPending} onClick={() => add.mutate()}
            className="mercury mt-2 h-9 w-full rounded-xl text-xs font-semibold disabled:opacity-40">Опубликовать</button>
        </div>
      )}
      {!posts || posts.length === 0
        ? <Empty icon={Handshake} text="Пока нет публикаций." />
        : posts.map((post) => (
          <div key={post.id} className="lrf p-3">
            <p className="whitespace-pre-wrap text-sm">{post.body}</p>
            <p className="mt-1.5 text-[10px] text-muted-foreground">{new Date(post.created_at).toLocaleString("ru-RU")}</p>
          </div>
        ))}
    </div>
  );
}

/* ---------- MEMBERS ---------- */
function MembersTab({ pid, isAdmin, members }: {
  pid: string; isAdmin: boolean;
  members: Array<{ id: string; user_id: string; role: string; share: number; status: string; profiles: { username: string; display_name: string; avatar_url: string | null } | null }>;
}) {
  const qc = useQueryClient();

  const { data: requests } = useQuery({
    queryKey: ["p-requests", pid],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("partnership_join_requests")
        .select("id, user_id, message, status, profiles:user_id(username, display_name)")
        .eq("partnership_id", pid).eq("status", "pending");
      if (error) throw error;
      return data as unknown as Array<{ id: string; message: string | null; profiles: { username: string; display_name: string } | null }>;
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("app_review_join_request", { p_request_id: id, p_approve: approve });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["p-requests", pid] });
      qc.invalidateQueries({ queryKey: ["p-members", pid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("partnership_members").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p-members", pid] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const invite = useMutation({
    mutationFn: async (username: string) => {
      const { error } = await supabase.rpc("app_invite_partner", {
        p_id: pid, p_username: username.trim(), p_role: inviteRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setInviteName("");
      toast.success("Участник приглашён");
      qc.invalidateQueries({ queryKey: ["p-members", pid] });
    },
    onError: (e: Error) => toast.error(
      e.message === "user_not_found" ? "Пользователь не найден"
        : e.message === "already_member" ? "Уже в партнёрстве" : e.message,
    ),
  });

  return (
    <div className="space-y-2">
      {isAdmin && (
        <div className="lrf p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <UserPlus className="size-3" /> Пригласить участника
          </p>
          <div className="flex items-center gap-2">
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="@username"
              className="lrf h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="lrf h-10 bg-transparent px-2 text-xs outline-none [&>option]:bg-background"
            >
              <option value="member">Участник</option>
              <option value="admin">Админ</option>
            </select>
            <button
              disabled={inviteName.trim().length < 2 || invite.isPending}
              onClick={() => invite.mutate(inviteName)}
              className="mercury h-10 shrink-0 rounded-2xl px-3 text-xs font-semibold disabled:opacity-40"
            >
              {invite.isPending ? "…" : "Пригласить"}
            </button>
          </div>
        </div>
      )}
      {isAdmin && requests && requests.length > 0 && (
        <div className="lrf p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Заявки на вступление</p>
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-2 py-1.5">
              <p className="flex-1 truncate text-xs">@{r.profiles?.username}</p>
              <button onClick={() => review.mutate({ id: r.id, approve: true })} className="grid size-8 place-items-center rounded-full bg-eco/25"><Check className="size-3.5" /></button>
              <button onClick={() => review.mutate({ id: r.id, approve: false })} className="grid size-8 place-items-center rounded-full bg-white/[0.06]"><XCircle className="size-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      {members.map((m) => (
        <div key={m.id} className="lrf flex items-center gap-3 p-3">
          {m.profiles?.avatar_url
            ? <img src={m.profiles.avatar_url} alt={m.profiles.display_name} className="size-9 rounded-full object-cover" />
            : <div className="grid size-9 place-items-center rounded-full bg-white/[0.07] text-[11px] font-semibold">{(m.profiles?.display_name ?? "?").slice(0, 1)}</div>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{m.profiles?.display_name}</p>
            <p className="text-[11px] text-muted-foreground">@{m.profiles?.username} · доля {m.share}%</p>
          </div>
          {isAdmin && m.role !== "founder" ? (
            <select value={m.role} onChange={(e) => setRole.mutate({ id: m.id, role: e.target.value })}
              className="lrf h-8 bg-transparent px-2 text-[11px] outline-none [&>option]:bg-background">
              <option value="member">участник</option>
              <option value="admin">админ</option>
              <option value="suspended">ограничен</option>
            </select>
          ) : (
            <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] text-muted-foreground">{m.role}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- WORK (projects + tasks) ---------- */
function WorkTab({ pid, isMember }: { pid: string; isMember: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [taskTitle, setTaskTitle] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["p-projects", pid],
    queryFn: async () => {
      const { data, error } = await supabase.from("partnership_projects").select("*")
        .eq("partnership_id", pid).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["p-tasks", pid],
    enabled: isMember,
    queryFn: async () => {
      const { data, error } = await supabase.from("partnership_tasks").select("*")
        .eq("partnership_id", pid).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("partnership_projects")
        .insert({ partnership_id: pid, title: title.trim(), created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); qc.invalidateQueries({ queryKey: ["p-projects", pid] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("partnership_tasks")
        .insert({ partnership_id: pid, title: taskTitle.trim(), created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { setTaskTitle(""); qc.invalidateQueries({ queryKey: ["p-tasks", pid] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("partnership_tasks").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p-tasks", pid] }),
  });

  return (
    <div className="space-y-4">
      <section>
        <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Проекты</p>
        {isMember && (
          <div className="lrf mb-2 flex items-center gap-2 p-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Новый проект"
              className="flex-1 bg-transparent px-1 text-sm outline-none" />
            <button disabled={!title.trim()} onClick={() => addProject.mutate()}
              className="mercury grid size-8 place-items-center rounded-full disabled:opacity-40"><Plus className="size-4" /></button>
          </div>
        )}
        {!projects || projects.length === 0
          ? <Empty icon={ListTodo} text="Проектов пока нет." />
          : projects.map((pr) => (
            <div key={pr.id} className="lrf mb-2 p-3">
              <p className="text-sm font-medium">{pr.title}</p>
              <p className="text-[11px] text-muted-foreground">{pr.status}</p>
            </div>
          ))}
      </section>

      {isMember && (
        <section>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Задачи</p>
          <div className="lrf mb-2 flex items-center gap-2 p-2">
            <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Новая задача"
              className="flex-1 bg-transparent px-1 text-sm outline-none" />
            <button disabled={!taskTitle.trim()} onClick={() => addTask.mutate()}
              className="mercury grid size-8 place-items-center rounded-full disabled:opacity-40"><Plus className="size-4" /></button>
          </div>
          {!tasks || tasks.length === 0
            ? <Empty icon={ListTodo} text="Задач пока нет." />
            : tasks.map((t) => (
              <button key={t.id} onClick={() => toggleTask.mutate({ id: t.id, done: !t.done })}
                className="lrf mb-2 flex w-full items-center gap-3 p-3 text-left">
                <span className={`grid size-5 place-items-center rounded-md border ${t.done ? "border-eco bg-eco/30" : "border-white/20"}`}>
                  {t.done && <Check className="size-3" />}
                </span>
                <span className={`flex-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
              </button>
            ))}
        </section>
      )}
    </div>
  );
}

/* ---------- FINANCE ---------- */
function FinanceTab({ pid, canEdit }: { pid: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("general");
  const [direction, setDirection] = useState<"income" | "expense">("income");

  const { data: rows } = useQuery({
    queryKey: ["p-finance", pid],
    queryFn: async () => {
      const { data, error } = await supabase.from("partnership_finance").select("*")
        .eq("partnership_id", pid).order("occurred_on", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const income = (rows ?? []).filter((r) => r.direction === "income").reduce((s, r) => s + Number(r.amount), 0);
  const expense = (rows ?? []).filter((r) => r.direction === "expense").reduce((s, r) => s + Number(r.amount), 0);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("partnership_finance").insert({
        partnership_id: pid, direction, amount: Math.round(Number(amount)),
        category, created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { setAmount(""); qc.invalidateQueries({ queryKey: ["p-finance", pid] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Доход" value={income} />
        <Stat label="Расход" value={expense} />
        <Stat label="Баланс" value={income - expense} />
      </div>
      {canEdit && (
        <div className="lrf space-y-2 p-3">
          <div className="flex gap-2">
            {(["income", "expense"] as const).map((d) => (
              <button key={d} onClick={() => setDirection(d)}
                className={`h-9 flex-1 rounded-xl text-xs font-medium ${direction === d ? "bg-eco/25" : "bg-white/[0.05] text-muted-foreground"}`}>
                {d === "income" ? "Поступление" : "Расход"}
              </button>
            ))}
          </div>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
            placeholder="Сумма" className="lrf h-10 w-full bg-transparent px-3 text-sm outline-none" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Категория"
            className="lrf h-10 w-full bg-transparent px-3 text-sm outline-none" />
          <button disabled={!amount || add.isPending} onClick={() => add.mutate()}
            className="mercury h-10 w-full rounded-2xl text-xs font-semibold disabled:opacity-40">Добавить запись</button>
        </div>
      )}
      {!rows || rows.length === 0
        ? <Empty icon={Wallet} text="Операций пока нет." />
        : rows.map((r) => (
          <div key={r.id} className="lrf flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{r.category}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(r.occurred_on).toLocaleDateString("ru-RU")}</p>
            </div>
            <p className={`text-sm font-semibold ${r.direction === "income" ? "text-eco" : "text-muted-foreground"}`}>
              {r.direction === "income" ? "+" : "−"}{fmt(Number(r.amount))}
            </p>
          </div>
        ))}
    </div>
  );
}

/* ---------- DOCS + AGREEMENT ---------- */
function DocsTab({ pid }: { pid: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: agreements } = useQuery({
    queryKey: ["p-agreements", pid],
    queryFn: async () => {
      const { data, error } = await supabase.from("partnership_agreements")
        .select("*, partnership_signatures(full_name, email, signed_at)")
        .eq("partnership_id", pid).order("version", { ascending: false });
      if (error) throw error;
      return data as unknown as Array<{
        id: string; version: number; doc_number: string; body: string; content_hash: string; created_at: string;
        partnership_signatures: Array<{ full_name: string; email: string; signed_at: string }>;
      }>;
    },
  });

  const { data: docs } = useQuery({
    queryKey: ["p-docs", pid],
    queryFn: async () => {
      const { data, error } = await supabase.from("partnership_documents").select("*")
        .eq("partnership_id", pid).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("partnership_documents")
        .insert({ partnership_id: pid, title: title.trim(), body, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setBody(""); qc.invalidateQueries({ queryKey: ["p-docs", pid] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partnership_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p-docs", pid] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {agreements?.map((a) => (
        <div key={a.id} className="lrf p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Соглашение · v{a.version}</p>
          <p className="font-mono text-xs text-eco">{a.doc_number}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-muted-foreground">{a.body}</pre>
          <p className="mt-2 break-all font-mono text-[9.5px] text-muted-foreground/70">SHA-256 {a.content_hash}</p>
          <div className="mt-2 space-y-1">
            {a.partnership_signatures.map((s, i) => (
              <p key={i} className="text-[11px]">
                <span className="text-eco">✓</span> {s.full_name} · {s.email} · {new Date(s.signed_at).toLocaleString("ru-RU")}
              </p>
            ))}
          </div>
        </div>
      ))}

      <div className="lrf space-y-2 p-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название документа"
          className="lrf h-10 w-full bg-transparent px-3 text-sm outline-none" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Содержимое"
          className="lrf w-full resize-none bg-transparent p-3 text-sm outline-none" />
        <button disabled={!title.trim()} onClick={() => add.mutate()}
          className="mercury h-10 w-full rounded-2xl text-xs font-semibold disabled:opacity-40">Добавить в архив</button>
      </div>

      {!docs || docs.length === 0
        ? <Empty icon={FileText} text="Документов пока нет." />
        : docs.map((d) => (
          <div key={d.id} className="lrf flex items-start gap-3 p-3">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{d.title} <span className="text-[10px] text-muted-foreground">v{d.version}</span></p>
              {d.body && <p className="line-clamp-2 text-[11px] text-muted-foreground">{d.body}</p>}
            </div>
            <button onClick={() => del.mutate(d.id)} className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06]">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
    </div>
  );
}

/* ---------- LOG ---------- */
function LogTab({ pid }: { pid: string }) {
  const { data } = useQuery({
    queryKey: ["p-log", pid],
    queryFn: async () => {
      const { data, error } = await supabase.from("partnership_log").select("*")
        .eq("partnership_id", pid).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  if (!data || data.length === 0) return <Empty icon={ScrollText} text="Журнал пуст." />;
  return (
    <ul className="space-y-2">
      {data.map((l) => (
        <li key={l.id} className="lrf p-3">
          <p className="font-mono text-[11px] text-eco">{l.action}</p>
          {l.details && <p className="text-[11px] text-muted-foreground">{l.details}</p>}
          <p className="text-[10px] text-muted-foreground/70">{new Date(l.created_at).toLocaleString("ru-RU")}</p>
        </li>
      ))}
    </ul>
  );
}
