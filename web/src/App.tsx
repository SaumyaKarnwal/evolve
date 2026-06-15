import { useEffect, useMemo, useState } from "react";
import { isTauri } from "./dataSource";
import { useScan } from "./hooks/useScan";
import { useAuth } from "./hooks/useAuth";
import { usePublications } from "./hooks/usePublications";
import { useDiscover } from "./hooks/useDiscover";
import { useProvenance } from "./hooks/useProvenance";
import { PublishContext, type PublishApi } from "./hooks/publishContext";
import { buildProjects } from "./lib/projects";
import { countByKind, filterItems, groupByKind } from "./lib/grouping";
import type { Kind } from "./types";
import { SideNav, NAV_ICONS } from "./components/SideNav";
import { SignInScreen } from "./components/SignInScreen";
import { ProjectList } from "./components/ProjectList";
import { Filters } from "./components/Filters";
import { PageHeader } from "./components/PageHeader";
import { KindSection } from "./components/KindSection";
import { BuildView } from "./components/BuildView";
import { DiscoverView } from "./components/DiscoverView";
import { PeopleView } from "./components/PeopleView";

type Tab = "global" | "projects" | "discover" | "people" | "build";

const NAV = [
  { id: "global" as const, label: "My Claude", icon: NAV_ICONS.myclaude },
  { id: "projects" as const, label: "Projects", icon: NAV_ICONS.projects },
  { id: "discover" as const, label: "Discover", icon: NAV_ICONS.discover },
  { id: "people" as const, label: "People", icon: NAV_ICONS.people },
  { id: "build" as const, label: "Build", icon: NAV_ICONS.build },
];

export default function App() {
  const auth = useAuth();
  const { items, loading, error, run } = useScan();
  const pubs = usePublications(!!auth.user);
  const provenance = useProvenance(!!auth.user);

  const [tab, setTab] = useState<Tab>("global");
  const discover = useDiscover(!!auth.user); // feed loaded whenever signed in (drives update badge)
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [query, setQuery] = useState("");

  // Once signed in, scan automatically; re-scan on window focus (picks up edits, drift).
  useEffect(() => {
    if (auth.user && !items && !loading) run();
  }, [auth.user, items, loading, run]);
  useEffect(() => {
    if (!auth.user) return;
    const onFocus = () => {
      if (!loading) run();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [auth.user, loading, run]);

  const projects = useMemo(() => buildProjects(items ?? []), [items]);
  const globalItems = useMemo(
    () => projects.find((p) => p.key === "__global")?.items ?? [],
    [projects],
  );
  const otherProjects = useMemo(() => projects.filter((p) => p.key !== "__global"), [projects]);
  const selectedProject = otherProjects.find((p) => p.key === projectKey) ?? null;
  const mineIds = useMemo(() => new Set(pubs.list.map((p) => p.id)), [pubs.list]);
  const destinations = useMemo(
    () => [
      { label: "Global", path: null as string | null },
      ...otherProjects.filter((p) => p.path).map((p) => ({ label: p.name, path: p.path as string })),
    ],
    [otherProjects],
  );

  // adopted local items (by kind+name) + latest revision available per source — for "update available"
  const adoptedByName = useMemo(() => {
    const m = new Map<string, { source_id: string; revision: number }>();
    for (const a of provenance.bySource.values()) m.set(`${a.kind.toLowerCase()} ${a.name}`, a);
    return m;
  }, [provenance.bySource]);
  const latestBySource = useMemo(
    () => new Map((discover.items ?? []).map((i) => [i.id, i.latest_revision])),
    [discover.items],
  );

  const publishApi: PublishApi = useMemo(
    () => ({
      signedIn: !!auth.user,
      stateOf: pubs.stateOf,
      publish: pubs.publish,
      unpublish: pubs.unpublish,
      isBusy: pubs.isBusy,
      updateFor: (item) => {
        const a = adoptedByName.get(`${item.kind.toLowerCase()} ${item.name}`);
        if (!a) return null;
        const latest = latestBySource.get(a.source_id);
        return latest !== undefined && latest > a.revision ? latest : null;
      },
    }),
    [auth.user, pubs, adoptedByName, latestBySource],
  );

  // count adopted items whose source has shipped a newer revision (the update badge)
  const updateCount = useMemo(() => {
    if (!discover.items) return 0;
    const latest = new Map(discover.items.map((i) => [i.id, i.latest_revision]));
    let n = 0;
    for (const [sid, a] of provenance.bySource) {
      const rev = latest.get(sid);
      if (rev !== undefined && rev > a.revision) n++;
    }
    return n;
  }, [discover.items, provenance.bySource]);

  const navItems = useMemo(
    () => NAV.map((n) => (n.id === "discover" ? { ...n, badge: updateCount } : n)),
    [updateCount],
  );

  const goTab = (t: Tab) => {
    setTab(t);
    setProjectKey(null);
    setKind(null);
    setQuery("");
  };
  const openProject = (key: string | null) => {
    setProjectKey(key);
    setKind(null);
    setQuery("");
  };

  if (auth.restoring) {
    return (
      <div className="app">
        <div className="loading">
          <span className="spinner" /> Restoring your session…
        </div>
      </div>
    );
  }
  if (!auth.user) {
    return (
      <SignInScreen onSignIn={auth.signIn} busy={auth.busy} canSignIn={isTauri} error={auth.error} />
    );
  }

  const showingProjectList = tab === "projects" && !selectedProject;
  const inScope = tab === "global" ? globalItems : selectedProject?.items ?? [];
  const publicCount = globalItems.filter((i) => pubs.stateOf(i).status !== "unpublished").length;
  const globalSummary =
    `${globalItems.length} items · ${publicCount} public · the rest stay private.`;
  const counts = countByKind(inScope);
  const visible = filterItems(inScope, kind, query);
  const sections = groupByKind(visible);

  return (
    <PublishContext.Provider value={publishApi}>
      <div className="app">
        <SideNav
          items={navItems}
          active={tab}
          onChange={goTab}
          user={auth.user}
          onSignOut={auth.logOut}
          count={items?.length ?? null}
        />
        <main className="main">
          {error && <div className="error">Couldn’t scan: {error}</div>}
          {pubs.error && <div className="error">Publish: {pubs.error}</div>}
          {!items && loading && (
            <div className="loading">
              <span className="spinner" /> Scanning ~/.claude…
            </div>
          )}

          {items && tab === "build" && (
            <BuildView
              user={auth.user}
              signedIn={!!auth.user}
              onSignIn={auth.signIn}
              signingIn={auth.busy}
              publications={pubs.list}
              onUnpublish={(p) => pubs.unpublish(p)}
            />
          )}

          {items && tab === "discover" && (
            <DiscoverView
              items={discover.items}
              loading={discover.loading}
              error={discover.error}
              destinations={destinations}
              localItems={items}
              mineIds={mineIds}
              provenance={provenance.bySource}
              onAdopted={provenance.refresh}
            />
          )}

          {items && tab === "people" && (
            <PeopleView
              items={discover.items}
              loading={discover.loading}
              error={discover.error}
              mineIds={mineIds}
              destinations={destinations}
              localItems={items}
            />
          )}

          {items && (tab === "global" || tab === "projects") && (
            <div className="page">
              {showingProjectList ? (
                <>
                  <PageHeader
                    eyebrow="By location"
                    title="Projects"
                    sub={`${otherProjects.length} projects with their own config and memory.`}
                  />
                  <ProjectList projects={otherProjects} onOpen={openProject} />
                </>
              ) : (
                <>
                  <PageHeader
                    eyebrow={tab === "global" ? "Your configuration" : "Project"}
                    title={tab === "global" ? "My Claude" : selectedProject!.name}
                    sub={
                      tab === "global"
                        ? globalSummary
                        : selectedProject!.path ??
                          (selectedProject!.unresolved
                            ? "Path could not be resolved from transcripts."
                            : undefined)
                    }
                    onBack={tab === "projects" ? () => openProject(null) : undefined}
                    backLabel="All projects"
                  />
                  <Filters
                    query={query}
                    onQuery={setQuery}
                    kind={kind}
                    onKind={setKind}
                    counts={counts}
                  />
                  {[...sections.entries()].map(([k, list]) => (
                    <KindSection key={k} kind={k} items={list} />
                  ))}
                  {visible.length === 0 && (
                    <div className="no-results">Nothing matches those filters.</div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </PublishContext.Provider>
  );
}
