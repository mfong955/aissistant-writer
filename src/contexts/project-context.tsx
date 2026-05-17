"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Project, Entity } from "@/types/database";

interface ProjectContextValue {
  project: Project | null;
  entities: Entity[];
  loading: boolean;
  refreshEntities: () => Promise<void>;
  setProject: (project: Project | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  project: initialProject,
  children,
}: {
  project: Project;
  children: ReactNode;
}) {
  const [project, setProject] = useState<Project | null>(initialProject);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshEntities = useCallback(async () => {
    if (!project) return;
    const res = await fetch(`/api/entities?project_id=${project.id}`);
    const data = (await res.json()) as { entities: Entity[] };
    if (data.entities) {
      setEntities(data.entities);
    }
    setLoading(false);
  }, [project]);

  useEffect(() => {
    refreshEntities();
  }, [refreshEntities]);

  return (
    <ProjectContext.Provider value={{ project, entities, loading, refreshEntities, setProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
