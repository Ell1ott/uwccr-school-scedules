import { useMemo, useSyncExternalStore } from "react";

export type ModerateDecision = "allow" | "deny";

export type AppRoute =
  | { page: "week" }
  | { page: "try-classes" }
  | { page: "events"; eventId?: string; draft?: "new" | "edit" }
  | {
      page: "cas";
      casId?: string;
      sessionId?: string;
      draft?: "new" | "edit" | "session-new" | "session-edit";
    }
  | { page: "login" }
  | { page: "admin" }
  | { page: "reach"; draft?: "new" }
  | { page: "gate" }
  | { page: "moderate"; token: string; decision: ModerateDecision | null };

type RouteHistoryState = {
  from?: string;
};

const listeners = new Set<() => void>();

function currentHref() {
  return `${window.location.pathname}${window.location.search}`;
}

let snapshot = typeof window === "undefined" ? "/" : currentHref();

function emit() {
  snapshot = currentHref();
  for (const listener of listeners) listener();
}

function onPopState() {
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("popstate", onPopState);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("popstate", onPopState);
    }
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return "/";
}

function readDecision(raw: string | null): ModerateDecision | null {
  return raw === "allow" || raw === "deny" ? raw : null;
}

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname || "/";
}

export function parseRoute(pathname: string, search: string): AppRoute {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const path = normalizePath(pathname);
  const segments = path === "/" ? [] : path.slice(1).split("/");

  if (path === "/login") return { page: "login" };
  if (path === "/admin") return { page: "admin" };
  if (path === "/reach/new") return { page: "reach", draft: "new" };
  if (path === "/reach") return { page: "reach" };
  if (path === "/gate") return { page: "gate" };
  if (path === "/moderate") {
    return {
      page: "moderate",
      token: params.get("token")?.trim() ?? "",
      decision: readDecision(params.get("decision")),
    };
  }
  if (path === "/try-classes") return { page: "try-classes" };
  if (segments[0] === "cas") {
    if (segments.length === 1) return { page: "cas" };
    if (segments.length === 2 && segments[1] === "new") {
      return { page: "cas", draft: "new" };
    }
    if (segments.length === 2) {
      return { page: "cas", casId: decodeURIComponent(segments[1]) };
    }
    if (segments.length === 3 && segments[2] === "edit" && segments[1] !== "new") {
      return {
        page: "cas",
        casId: decodeURIComponent(segments[1]),
        draft: "edit",
      };
    }
    if (
      segments.length === 4 &&
      segments[2] === "sessions" &&
      segments[3] === "new" &&
      segments[1] !== "new"
    ) {
      return {
        page: "cas",
        casId: decodeURIComponent(segments[1]),
        draft: "session-new",
      };
    }
    if (
      segments.length === 4 &&
      segments[2] === "sessions" &&
      segments[1] !== "new" &&
      segments[3] !== "new"
    ) {
      return {
        page: "cas",
        casId: decodeURIComponent(segments[1]),
        sessionId: decodeURIComponent(segments[3]),
      };
    }
    if (
      segments.length === 5 &&
      segments[2] === "sessions" &&
      segments[4] === "edit"
    ) {
      return {
        page: "cas",
        casId: decodeURIComponent(segments[1]),
        sessionId: decodeURIComponent(segments[3]),
        draft: "session-edit",
      };
    }
  }
  if (segments[0] === "events") {
    if (segments.length === 1) return { page: "events" };
    if (segments.length === 2 && segments[1] === "new") {
      return { page: "events", draft: "new" };
    }
    if (segments.length === 2) {
      return { page: "events", eventId: decodeURIComponent(segments[1]) };
    }
    if (segments.length === 3 && segments[2] === "edit" && segments[1] !== "new") {
      return {
        page: "events",
        eventId: decodeURIComponent(segments[1]),
        draft: "edit",
      };
    }
  }

  const view = params.get("view");
  if (view === "login") return { page: "login" };
  if (view === "admin") return { page: "admin" };
  if (view === "moderate") {
    return {
      page: "moderate",
      token: params.get("token")?.trim() ?? "",
      decision: readDecision(params.get("decision")),
    };
  }

  return { page: "week" };
}

export function parseHref(href: string): AppRoute {
  const [pathAndSearch] = href.split("#");
  const q = pathAndSearch.indexOf("?");
  if (q === -1) return parseRoute(pathAndSearch || "/", "");
  return parseRoute(pathAndSearch.slice(0, q), pathAndSearch.slice(q));
}

export function toPath(route: AppRoute): string {
  switch (route.page) {
    case "week":
      return "/";
    case "try-classes":
      return "/try-classes";
    case "login":
      return "/login";
    case "admin":
      return "/admin";
    case "reach":
      return route.draft === "new" ? "/reach/new" : "/reach";
    case "gate":
      return "/gate";
    case "moderate": {
      const params = new URLSearchParams();
      if (route.token) params.set("token", route.token);
      if (route.decision) params.set("decision", route.decision);
      const query = params.toString();
      return query ? `/moderate?${query}` : "/moderate";
    }
    case "cas":
      if (route.draft === "new") return "/cas/new";
      if (route.casId && route.draft === "edit") {
        return `/cas/${encodeURIComponent(route.casId)}/edit`;
      }
      if (route.casId && route.draft === "session-new") {
        return `/cas/${encodeURIComponent(route.casId)}/sessions/new`;
      }
      if (route.casId && route.sessionId && route.draft === "session-edit") {
        return `/cas/${encodeURIComponent(route.casId)}/sessions/${encodeURIComponent(route.sessionId)}/edit`;
      }
      if (route.casId && route.sessionId) {
        return `/cas/${encodeURIComponent(route.casId)}/sessions/${encodeURIComponent(route.sessionId)}`;
      }
      if (route.casId) return `/cas/${encodeURIComponent(route.casId)}`;
      return "/cas";
    case "events":
      if (route.draft === "new") return "/events/new";
      if (route.eventId && route.draft === "edit") {
        return `/events/${encodeURIComponent(route.eventId)}/edit`;
      }
      if (route.eventId) return `/events/${encodeURIComponent(route.eventId)}`;
      return "/events";
  }
}

export function navigate(route: AppRoute, options?: { replace?: boolean }) {
  const next = toPath(route);
  const current = currentHref();
  if (next === current) return;
  if (options?.replace) {
    window.history.replaceState(window.history.state, "", next);
  } else {
    const state: RouteHistoryState = { from: current };
    window.history.pushState(state, "", next);
  }
  emit();
}

export function previousRoute(): AppRoute | null {
  const from = (window.history.state as RouteHistoryState | null)?.from;
  if (typeof from !== "string" || !from) return null;
  const route = parseHref(from);
  if (
    route.page === "login" ||
    route.page === "admin" ||
    route.page === "moderate" ||
    route.page === "gate"
  ) {
    return null;
  }
  return route;
}

export function useAppRoute(): AppRoute {
  const href = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => parseHref(href), [href]);
}
