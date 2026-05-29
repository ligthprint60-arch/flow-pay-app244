import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
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
