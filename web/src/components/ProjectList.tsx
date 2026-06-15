import type { Project } from "../lib/projects";
import { countByKind } from "../lib/grouping";

interface ProjectListProps {
  projects: Project[];
  onOpen: (key: string) => void;
}

/** The Projects tab landing: a card per project. Click one to drill into its config. */
export function ProjectList({ projects, onOpen }: ProjectListProps) {
  if (projects.length === 0) {
    return <div className="no-results">No projects found.</div>;
  }
  return (
    <div className="project-list">
      {projects.map((p) => {
        const counts = countByKind(p.items);
        return (
          <button
            key={p.key}
            className="card project-card"
            onClick={() => onOpen(p.key)}
            title={p.path ?? p.name}
          >
            <span className="project-card-name">{p.name}</span>
            <span className="project-card-path">
              {p.unresolved ? "unresolved path" : p.path}
            </span>
            <span className="project-card-meta">
              {p.items.length} items · {counts.Skill} skills · {counts.Rule} rules ·{" "}
              {counts.Memory} memory
            </span>
          </button>
        );
      })}
    </div>
  );
}
