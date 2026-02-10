"use client";

import { type ReactNode } from "react";
import { Allotment } from "allotment";
import { Button } from "@/components/ui/button";

interface AllotmentLayoutProps {
  sidebar: ReactNode;
  editor: ReactNode;
  chat: ReactNode;
  sidebarVisible: boolean;
  chatVisible: boolean;
  onChatPopout: () => void;
}

export function AllotmentLayout({
  sidebar,
  editor,
  chat,
  sidebarVisible,
  chatVisible,
  onChatPopout,
}: AllotmentLayoutProps) {
  return (
    <Allotment>
      <Allotment.Pane
        preferredSize={260}
        minSize={200}
        maxSize={400}
        visible={sidebarVisible}
      >
        <div className="h-full overflow-auto border-r bg-sidebar-background">
          {sidebar}
        </div>
      </Allotment.Pane>
      <Allotment.Pane minSize={300}>
        <div className="h-full overflow-hidden">{editor}</div>
      </Allotment.Pane>
      <Allotment.Pane
        preferredSize={380}
        minSize={300}
        maxSize={600}
        visible={chatVisible}
      >
        <div className="flex h-full flex-col border-l">
          <div className="flex items-center justify-end border-b px-2 py-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onChatPopout}
              className="text-xs text-muted-foreground"
            >
              Pop out
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">{chat}</div>
        </div>
      </Allotment.Pane>
    </Allotment>
  );
}
