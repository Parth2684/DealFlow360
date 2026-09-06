"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DARK_MEDIA_QUERY,
  applyTheme,
  readStoredPreference,
  resolveTheme,
  storePreference,
  systemTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "../../lib/theme";

export interface RevealOrigin {
  x: number;
  y: number;
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (next: ThemePreference, origin?: RevealOrigin) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// useLayoutEffect is a no-op during SSR and warns if called there.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const REVEAL_DURATION_MS = 480;
const CROSS_FADE_DURATION_MS = 340;
const SWAP_SAFETY_NET_MS = 250;

interface ViewTransition {
  ready: Promise<void>;
  finished: Promise<void>;
}

/**
 * `startViewTransition` is still unevenly supported, so it is read defensively
 * rather than through a lib.dom declaration.
 */
function viewTransitionStarter():
  ((update: () => void) => ViewTransition) | null {
  const candidate: unknown = Reflect.get(document, "startViewTransition");

  if (typeof candidate !== "function") return null;

  const start = candidate.bind(document);
  return (update: () => void) => start(update) as ViewTransition;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function crossFade(update: () => void): void {
  const root = document.documentElement;

  root.setAttribute("data-theme-switching", "");
  update();
  window.setTimeout(() => {
    root.removeAttribute("data-theme-switching");
  }, CROSS_FADE_DURATION_MS);
}

function circularReveal(update: () => void, origin: RevealOrigin): void {
  const start = viewTransitionStarter();

  // A hidden document never reaches the capture step, so the browser would
  // hold the update callback indefinitely and the theme would never apply.
  if (!start || document.visibilityState !== "visible") {
    crossFade(update);
    return;
  }

  const root = document.documentElement;
  root.setAttribute("data-theme-reveal", "");

  // The swap must survive a transition the browser declines to run, so it is
  // applied once either by the callback or by this safety net.
  let applied = false;
  function applyOnce() {
    if (applied) return;
    applied = true;
    update();
  }

  const safetyNet = window.setTimeout(applyOnce, SWAP_SAFETY_NET_MS);
  const transition = start(applyOnce);
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );

  void transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: REVEAL_DURATION_MS,
          easing: "cubic-bezier(0.32, 0.72, 0, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      // A refused transition still leaves the theme applied by `update`.
    });

  void transition.finished
    .catch(() => undefined)
    .finally(() => {
      window.clearTimeout(safetyNet);
      applyOnce();
      root.removeAttribute("data-theme-reveal");
    });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // The pre-paint script already applied the stored theme; this adopts it into
  // React state. The re-apply matters in development, where React drops
  // <html> attributes it does not own when Strict Mode remounts.
  useIsomorphicLayoutEffect(() => {
    const stored = readStoredPreference();
    const resolved = resolveTheme(stored);

    setPreferenceState(stored);
    setResolvedTheme(resolved);
    applyTheme(stored, resolved);
  }, []);

  useEffect(() => {
    if (preference !== "system") return;

    const media = window.matchMedia(DARK_MEDIA_QUERY);

    function syncSystemTheme() {
      const next = systemTheme();
      setResolvedTheme(next);
      applyTheme("system", next);
    }

    media.addEventListener("change", syncSystemTheme);
    return () => {
      media.removeEventListener("change", syncSystemTheme);
    };
  }, [preference]);

  const setPreference = useCallback(
    (next: ThemePreference, origin?: RevealOrigin) => {
      const nextResolved = resolveTheme(next);

      function update() {
        applyTheme(next, nextResolved);
      }

      setPreferenceState(next);
      setResolvedTheme(nextResolved);
      storePreference(next);

      if (prefersReducedMotion()) {
        update();
        return;
      }

      if (origin) {
        circularReveal(update, origin);
      } else {
        crossFade(update);
      }
    },
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider.");
  }

  return context;
}
