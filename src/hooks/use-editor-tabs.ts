"use client";

import { useState, useCallback } from "react";
import type { Entity } from "@/types/database";
import type { TabItem } from "@/types";

export function useEditorTabs() {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTab = useCallback((entity: Entity) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.entityId === entity.id);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const newTab: TabItem = {
        id: entity.id,
        entityId: entity.id,
        name: entity.name,
        type: entity.type,
        isModified: false,
      };
      setActiveTabId(newTab.id);
      return [...prev, newTab];
    });
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        const newTabs = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          if (newTabs.length === 0) {
            setActiveTabId(null);
          } else if (idx >= newTabs.length) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
          } else {
            setActiveTabId(newTabs[idx].id);
          }
        }
        return newTabs;
      });
    },
    [activeTabId]
  );

  const switchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const markModified = useCallback((tabId: string, isModified: boolean) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isModified } : t))
    );
  }, []);

  const updateTabName = useCallback((entityId: string, name: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.entityId === entityId ? { ...t, name } : t))
    );
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  return {
    tabs,
    activeTab,
    activeTabId,
    openTab,
    closeTab,
    switchTab,
    markModified,
    updateTabName,
  };
}
