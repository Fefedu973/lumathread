import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./components/theme";
import { HomePage } from "./pages/home";
import { resolveSiteRoute } from "./routing";
import "./globals.css";

const LabPage = lazy(() => import("./pages/lab"));

const root = document.getElementById("root");

if (!root) {
  throw new Error("LumaThread site root was not found.");
}

const route = resolveSiteRoute(
  window.location.pathname,
  import.meta.env.BASE_URL,
);

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <Suspense
        fallback={
          <div className="grid min-h-svh place-items-center bg-background font-mono text-sm text-muted-foreground">
            Loading LumaThread…
          </div>
        }
      >
        {route === "/lab" ? <LabPage /> : <HomePage />}
      </Suspense>
    </ThemeProvider>
  </StrictMode>,
);
