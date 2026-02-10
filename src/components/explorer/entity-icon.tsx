import {
  User,
  BookOpen,
  List,
  StickyNote,
  Globe,
  File,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { EntityType } from "@/types/database";

const iconMap: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  character: User,
  chapter: BookOpen,
  outline: List,
  note: StickyNote,
  world_building: Globe,
  custom: File,
  folder: Folder,
};

export function EntityIcon({
  type,
  isOpen,
  className,
}: {
  type: EntityType;
  isOpen?: boolean;
  className?: string;
}) {
  if (type === "folder" && isOpen) {
    return <FolderOpen className={className} />;
  }
  const Icon = iconMap[type] || File;
  return <Icon className={className} />;
}
