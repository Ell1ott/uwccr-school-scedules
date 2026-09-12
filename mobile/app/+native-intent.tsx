function homePath() {
  return "/";
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const raw = path.trim();
    if (!raw || raw === "/" || raw === "//" || raw === "///") return homePath();

    const url = raw.includes("://") ? new URL(raw) : new URL(raw, "uwccr://dummy");
    const host = url.hostname;
    const route = (url.pathname || "/").replace(/\/+$/, "") || "/";

    if (!host && route === "/") return homePath();
    if (host === "auth" || route === "/auth") return homePath();
    if (host === "dummy" && route === "/") return homePath();

    return `${route}${url.search}`;
  } catch {
    return homePath();
  }
}
