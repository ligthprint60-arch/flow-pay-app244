import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/sandbox/$username")({
  head: () => ({ meta: [{ title: "Песочница — FLOW" }] }),
  component: SandboxPage,
});

function SandboxPage() {
  const { username } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["sandbox", username],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("username,display_name,sandbox_html,premium_until")
        .ilike("username", username.replace(/^@/, ""))
        .maybeSingle();
      return data;
    },
  });

  const isPremium = !!data?.premium_until && new Date(data.premium_until) > new Date();
  const html = isPremium ? (data?.sandbox_html ?? "") : "";

  return (
    <div className="min-h-svh px-4 pb-6 pt-10">
      <div className="lrf mb-3 flex items-center gap-2 !rounded-3xl px-3 py-2">
        <Link to="/feed" className="grid size-9 place-items-center rounded-full bg-white/[0.06] lrf-tap">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Песочница</p>
          <p className="truncate text-[11px] text-muted-foreground">@{data?.username ?? username}</p>
        </div>
      </div>
      {isLoading ? (
        <div className="acrylic p-10 text-center text-sm text-muted-foreground">Загрузка...</div>
      ) : !html ? (
        <div className="acrylic p-10 text-center text-sm text-muted-foreground">
          У пользователя нет страницы или подписка истекла.
        </div>
      ) : (
        <div className="lrf overflow-hidden !rounded-3xl">
          <iframe
            title={`sandbox-${username}`}
            sandbox="allow-scripts"
            srcDoc={html}
            className="block h-[70vh] w-full bg-white"
          />
        </div>
      )}
    </div>
  );
}
