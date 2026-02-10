import type { Entity } from "@/types/database";
import type { TreeNode } from "@/types";

export function buildTree(entities: Entity[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const entity of entities) {
    map.set(entity.id, { entity, children: [] });
  }

  for (const entity of entities) {
    const node = map.get(entity.id)!;
    if (entity.parent_id && map.has(entity.parent_id)) {
      map.get(entity.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.entity.type === "folder" && b.entity.type !== "folder") return -1;
      if (a.entity.type !== "folder" && b.entity.type === "folder") return 1;
      return a.entity.sort_order - b.entity.sort_order;
    });
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };

  sortChildren(roots);
  return roots;
}

export function findNode(
  tree: TreeNode[],
  id: string
): TreeNode | undefined {
  for (const node of tree) {
    if (node.entity.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

export function flattenTree(tree: TreeNode[]): Entity[] {
  const result: Entity[] = [];
  for (const node of tree) {
    result.push(node.entity);
    result.push(...flattenTree(node.children));
  }
  return result;
}
