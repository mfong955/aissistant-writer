import { createChangeLog } from "@/lib/api/change-logs";
import type { Entity, ChangeActor } from "@/types/database";

export async function logEntityCreate(
  entity: Entity,
  actor: ChangeActor = "user"
) {
  await createChangeLog({
    projectId: entity.project_id,
    entityId: entity.id,
    action: "create",
    actor,
    description: `Created ${entity.type}: ${entity.name}`,
    newVersionHash: entity.version_hash,
  });
}

export async function logEntityUpdate(
  entity: Entity,
  oldVersionHash: string | null,
  actor: ChangeActor = "user",
  description?: string
) {
  // Only log if the content actually changed
  if (oldVersionHash === entity.version_hash) return;

  await createChangeLog({
    projectId: entity.project_id,
    entityId: entity.id,
    action: "update",
    actor,
    description: description || `Updated ${entity.type}: ${entity.name}`,
    oldVersionHash,
    newVersionHash: entity.version_hash,
  });
}

export async function logEntityRename(
  entity: Entity,
  oldName: string,
  actor: ChangeActor = "user"
) {
  await createChangeLog({
    projectId: entity.project_id,
    entityId: entity.id,
    action: "rename",
    actor,
    description: `Renamed ${entity.type}: "${oldName}" to "${entity.name}"`,
  });
}

export async function logEntityDelete(
  projectId: string,
  entityId: string,
  entityType: string,
  entityName: string,
  actor: ChangeActor = "user"
) {
  await createChangeLog({
    projectId,
    entityId,
    action: "delete",
    actor,
    description: `Deleted ${entityType}: ${entityName}`,
  });
}
