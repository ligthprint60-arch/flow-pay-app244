import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { FluidBackground } from "@/components/FluidBackground";
import { startGlassObserver } from "@/lib/glass-observer";
import { startChronos } from "@/lib/chronos/runtime";


import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">404 / Not Found</p>
        <h1 className="mt-4 text-2xl font-semibold">Маршрут не существует</h1>
        <a href="/" className="mt-6 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background">
          На главную
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-destructive">Runtime error</p>
        <h1 className="mt-3 text-xl font-semibold">{error.message}</h1>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
        >
          Повторить
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0E1117" },
      { title: "FLOW pay" },
      { name: "description", content: "Минималистичная цифровая платёжная сеть с двухтокенной моделью и социальным слоем финансовой грамотности." },
      { property: "og:title", content: "FLOW pay" },
      { name: "twitter:title", content: "FLOW pay" },
      { property: "og:description", content: "Минималистичная цифровая платёжная сеть с двухтокенной моделью и социальным слоем финансовой грамотности." },
      { name: "twitter:description", content: "Минималистичная цифровая платёжная сеть с двухтокенной моделью и социальным слоем финансовой грамотности." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/68fd8edd-fb00-417e-b000-97d9fcefaadf/id-preview-03da7c00--50a8c527-9f73-40f5-80ab-e4661565dfc3.lovable.app-1780038902025.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/68fd8edd-fb00-417e-b000-97d9fcefaadf/id-preview-03da7c00--50a8c527-9f73-40f5-80ab-e4661565dfc3.lovable.app-1780038902025.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <HeadContent />
      </head>
      <body>
        <div
          id="flow-app-bg"
          aria-hidden
          style={{
            position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
            backgroundSize: "cover", backgroundPosition: "center",
            opacity: 0, transition: "opacity .5s ease",
          }}
        />
        <video
          id="flow-app-bg-video"
          aria-hidden
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
            width: "100%", height: "100%", objectFit: "cover",
            opacity: 0, transition: "opacity .5s ease",
          }}
        />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // ChronosGPU: one rAF consumer for the whole document, started before any
  // producer so early mutations are never dropped.
  useEffect(() => startChronos(), []);
  useEffect(() => startGlassObserver(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FluidBackground />
        <Outlet />
        <Toaster theme="dark" position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

