import { useEffect, useMemo, useState } from "react";
import { isTauri } from "./dataSource";
import { useScan } from "./hooks/useScan";
import { useAuth } from "./hooks/useAuth";
import { usePublications } from "./hooks/usePublications";
import { useDiscover } from "./hooks/useDiscover";
import { PublishContext, type PublishApi } from "./hooks/publishContext";
import { buildProjects } from "./lib/projects";
import { countByKind, filterItems, groupByKind } from "./lib/grouping";
import type { Kind } from "./types";
import { Topbar } from "./components/Topbar";
import { Tabs } from "./components/Tabs";
import { AuthButton } from "./components/AuthButton";
import { SignInScreen } from "./components/SignInScreen";
import { ProjectList } from "./components/ProjectList";
import { Filters } from "./components/Filters";
import { PageHeader } from "./components/PageHeader";
import { KindSection } from "./components/KindSection";
import { BuildView } from "./components/BuildView";
import { DiscoverView } from "./components/DiscoverView";

type Tab = "global" | "projects" | "build" | "discover";

export default function App() {
  const auth = useAuth();
  const { items, loading, error, run } = useScan();
  const pubs = usePublications(!!auth.user);

  const [tab, setTab] = useState<Tab>("global");
  const discover = useDiscover(tab === "discover" && !!auth.user);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [query, setQuery] = useState("");

  // Once signed in, scan automatically — no manual Sync button.
  useEffect(() => {
    if (auth.user && !items && !loading) run();
  }, [auth.user, items, loading, run]);

  // Re-scan when the window regains focus, so edits made in your editor are picked up (and drift
  // against published versions is detected) without a manual Sync button.
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

  const publishApi: PublishApi = useMemo(
    () => ({
      signedIn: !!auth.user,
      stateOf: pubs.stateOf,
      publish: pubs.publish,
      unpublish: pubs.unpublish,
      isBusy: pubs.isBusy,
    }),
    [auth.user, pubs],
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

  // --- gated states: restoring session → sign-in → app ---
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
      <SignInScreen
        onSignIn={auth.signIn}
        busy={auth.busy}
        canSignIn={isTauri}
        error={auth.error}
      />
    );
  }

  const showingProjectList = tab === "projects" && !selectedProject;
  const inScope = tab === "global" ? globalItems : selectedProject?.items ?? [];
  const counts = countByKind(inScope);
  const visible = filterItems(inScope, kind, query);
  const sections = groupByKind(visible);

  return (
    <PublishContext.Provider value={publishApi}>
      <div className="app">
        <Topbar
          count={items?.length ?? null}
          authArea={
            <AuthButton
              user={auth.user}
              busy={auth.busy}
              onSignIn={auth.signIn}
              onSignOut={auth.logOut}
            />
          }
        >
          <Tabs
            tabs={[
              { id: "global", label: "Global" },
              { id: "projects", label: "Projects" },
              { id: "build", label: "Build" },
              { id: "discover", label: "Discover" },
            ]}
            active={tab}
            onChange={goTab}
          />
        </Topbar>

        {error && <div className="error">Couldn’t scan: {error}</div>}
        {pubs.error && <div className="error">Publish: {pubs.error}</div>}

        {!items && loading && (
          <div className="loading">
            <span className="spinner" /> Scanning ~/.claude…
          </div>
        )}

        {items && (
          <main className="main">
            {tab === "build" ? (
              <BuildView
                signedIn={!!auth.user}
                onSignIn={auth.signIn}
                signingIn={auth.busy}
                publications={pubs.list}
                onUnpublish={(p) => pubs.unpublish(p)}
              />
            ) : tab === "discover" ? (
              <DiscoverView
                items={discover.items}
                loading={discover.loading}
                error={discover.error}
              />
            ) : (
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
                      title={tab === "global" ? "Your Claude, globally" : selectedProject!.name}
                      sub={
                        tab === "global"
                          ? "Skills, rules, commands and agents available in every session — your shareable setup."
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
        )}
      </div>
    </PublishContext.Provider>
  );
}
