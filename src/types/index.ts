import type { Entity, EntityType } from "./database";

export type { EntityType } from "./database";

export interface TreeNode {
  entity: Entity;
  children: TreeNode[];
}

export interface TabItem {
  id: string;
  entityId: string;
  name: string;
  type: EntityType;
  isModified: boolean;
}
