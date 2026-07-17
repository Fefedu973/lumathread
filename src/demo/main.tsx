import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { resolveDemoRoute } from "./routing";
import "./styles.css";

const HeroBackgroundLab = lazy(() => import("./HeroBackgroundLab"));
const BenchmarkPage = lazy(() => import("./BenchmarkPage"));

const root = document.getElementById("root");

if (!root) {
  throw new Error("LumaThread demo root was not found.");
}

const route = resolveDemoRoute(
  window.location.pathname,
  import.meta.env.BASE_URL,
);
const page =
  route === "/dev/hero-background" ? (
    <HeroBackgroundLab />
  ) : route === "/dev/benchmark" ? (
    <BenchmarkPage />
  ) : (
    <App />
  );

createRoot(root).render(
  <StrictMode>
    <Suspense
      fallback={<div className="route-loading">Loading LumaThread…</div>}
    >
      {page}
    </Suspense>
  </StrictMode>,
);
