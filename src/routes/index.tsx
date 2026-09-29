import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "FLOW — кошелёк и сеть" },
    { name: "description", content: "FLOW: цифровой кошелёк, платежи и социальная сеть." },
    { property: "og:title", content: "FLOW — кошелёк и сеть" },
    { property: "og:description", content: "Цифровой кошелёк, платежи и социальная сеть FLOW." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Index,
});

function Index() {
  const { loading, user } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-2 animate-pulse rounded-full bg-eco" />
      </div>
    );
  }
  return <Navigate to={user ? "/wallet" : "/auth"} replace />;
}
