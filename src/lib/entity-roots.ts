import type { Entity } from "@/types/database";

// The three permanent top-level explorer containers. See docs/onboarding-workflows.md §1.
// Enforced at the application layer: entities keep plain `type`/`parent_id`, and a root is
// just a folder entity tagged via `properties._reserved`.
export type ExplorerRootKey = "canon" | "manuscript" | "unsorted";

export const EXPLORER_ROOTS: { key: ExplorerRootKey; name: string; sortOrder: number }[] = [
  { key: "canon", name: "Canon", sortOrder: -30 },
  { key: "manuscript", name: "Manuscript", sortOrder: -29 },
  { key: "unsorted", name: "Unsorted", sortOrder: -28 },
];

export function reservedRootTag(key: ExplorerRootKey): string {
  return `root_${key}`;
}

export function explorerRootKeyFromEntity(entity: Pick<Entity, "properties">): ExplorerRootKey | null {
  const tag = (entity.properties as Record<string, unknown> | null)?._reserved;
  if (typeof tag !== "string" || !tag.startsWith("root_")) return null;
  const key = tag.slice("root_".length);
  return EXPLORER_ROOTS.some((r) => r.key === key) ? (key as ExplorerRootKey) : null;
}

export function isExplorerRootEntity(entity: Pick<Entity, "properties">): boolean {
  return explorerRootKeyFromEntity(entity) !== null;
}

/** Walks the parent chain to find which of the three fixed roots an entity lives under, if any. */
export function findRootKeyForEntity(
  entity: Entity,
  entityById: Map<string, Entity>
): ExplorerRootKey | null {
  let current: Entity | undefined = entity;
  const seen = new Set<string>();
  while (current) {
    const rootKey = explorerRootKeyFromEntity(current);
    if (rootKey) return rootKey;
    if (!current.parent_id || seen.has(current.id)) return null;
    seen.add(current.id);
    current = entityById.get(current.parent_id);
  }
  return null;
}
