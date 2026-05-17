import {
  User,
  BookOpen,
  List,
  StickyNote,
  Globe,
  File,
  Folder,
  FolderOpen,
  Sparkles,
  History,
  ScrollText,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

const colorMap: Record<EntityType, string> = {
  character: "text-blue-500",
  chapter: "text-amber-500",
  outline: "text-violet-500",
  note: "text-yellow-500",
  world_building: "text-emerald-500",
  custom: "text-slate-400",
  folder: "text-orange-400",
};

export function EntityIcon({
  type,
  isOpen,
  name,
  className,
}: {
  type: EntityType;
  isOpen?: boolean;
  name?: string;
  className?: string;
}) {
  // Reserved special entities get distinct icons and colors
  if (name === "Project Progress") {
    return <ListChecks className={cn("text-teal-500", className)} />;
  }
  if (name === "AI Instructions") {
    return <Sparkles className={cn("text-purple-500", className)} />;
  }
  if (name === "Logs") {
    return isOpen
      ? <History className={cn("text-indigo-400", className)} />
      : <History className={cn("text-indigo-400", className)} />;
  }
  // Entries inside the Logs folder
  if (type === "note" && name?.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return <ScrollText className={cn("text-indigo-300", className)} />;
  }

  const color = colorMap[type] ?? "text-muted-foreground";
  if (type === "folder" && isOpen) {
    return <FolderOpen className={cn(color, className)} />;
  }
  const Icon = iconMap[type] ?? File;
  return <Icon className={cn(color, className)} />;
}
