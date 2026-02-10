"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { PanelLeftClose, PanelLeftOpen, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const AllotmentLayout = dynamic(
  () =>
    import("./allotment-layout").then((mod) => ({
      default: mod.AllotmentLayout,
    })),
  { ssr: false }
);

interface AppShellProps {
  sidebar: ReactNode;
  editor: ReactNode;
  chat: ReactNode;
  topBar: ReactNode;
}

export function AppShell({ sidebar, editor, chat, topBar }: AppShellProps) {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [chatVisible, setChatVisible] = useState(true);
  const [chatPopout, setChatPopout] = useState(false);

  if (chatPopout) {
    return (
      <div className="flex h-screen flex-col">
        <div className="flex items-center justify-between border-b px-4 py-2">
          {topBar}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChatPopout(false)}
              title="Dock chat panel"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">{chat}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        {topBar}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarVisible(!sidebarVisible)}
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarVisible ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setChatVisible(!chatVisible)}
            title={chatVisible ? "Hide chat" : "Show chat"}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <AllotmentLayout
          sidebar={sidebar}
          editor={editor}
          chat={chat}
          sidebarVisible={sidebarVisible}
          chatVisible={chatVisible}
          onChatPopout={() => setChatPopout(true)}
        />
      </div>
    </div>
  );
}
