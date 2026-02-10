"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityIcon } from "@/components/explorer/entity-icon";
import type { TabItem } from "@/types";

interface EditorTabsProps {
  tabs: TabItem[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

export function EditorTabs({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
}: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex border-b bg-muted/30">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "group flex max-w-[200px] cursor-pointer items-center gap-1.5 border-r px-3 py-1.5 text-sm",
            tab.id === activeTabId
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:bg-background/50"
          )}
          onClick={() => onSwitch(tab.id)}
          onMouseDown={(e) => {
            // Middle-click to close
            if (e.button === 1) {
              e.preventDefault();
              onClose(tab.id);
            }
          }}
        >
          <EntityIcon type={tab.type} className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{tab.name}</span>
          {tab.isModified && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
          )}
          <button
            className="ml-auto shrink-0 rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
