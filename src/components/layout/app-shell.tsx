"use client";

import { type ReactNode } from "react";
import dynamic from "next/dynamic";

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
  return (
    <div className="flex h-screen flex-col">
      <div className="border-b px-4 py-2">
        {topBar}
      </div>
      <div className="flex-1 overflow-hidden">
        <AllotmentLayout sidebar={sidebar} editor={editor} chat={chat} />
      </div>
    </div>
  );
}
