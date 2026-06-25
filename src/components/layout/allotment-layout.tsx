"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { Allotment, type AllotmentHandle } from "allotment";
import {
  PanelLeftOpen,
  PanelLeftClose,
  PanelRightOpen,
  PanelRightClose,
  MessageSquare,
  LayoutList,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type PanelState = "normal" | "expanded" | "minimized";

interface AllotmentLayoutProps {
  sidebar: ReactNode;
  editor: ReactNode;
  chat: ReactNode;
}

const MINIMIZED = 36;
const SIDEBAR_NORMAL = 260;
const SIDEBAR_EXPANDED = 420;
const CHAT_NORMAL = 380;

export function AllotmentLayout({ sidebar, editor, chat }: AllotmentLayoutProps) {
  const allotmentRef = useRef<AllotmentHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sidebarState, setSidebarState] = useState<PanelState>("normal");
  const [chatState, setChatState] = useState<PanelState>("normal");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const preFocusStates = useRef<{ sb: PanelState; ch: PanelState }>({ sb: "normal", ch: "normal" });

  function applyResize(sb: PanelState, ch: PanelState) {
    if (!allotmentRef.current || !containerRef.current) return;
    const total = containerRef.current.offsetWidth;
    const sbPx = sb === "minimized" ? MINIMIZED : sb === "expanded" ? SIDEBAR_EXPANDED : SIDEBAR_NORMAL;
    const chPx = ch === "minimized" ? MINIMIZED : ch === "expanded" ? Math.floor((total - sbPx) / 2) : CHAT_NORMAL;
    const edPx = Math.max(200, total - sbPx - chPx);
    allotmentRef.current.resize([sbPx, edPx, chPx]);
  }

  function cycleSidebar() {
    setSidebarState((prev) => {
      const next: PanelState = prev === "normal" ? "expanded" : prev === "expanded" ? "minimized" : "normal";
      applyResize(next, chatState);
      return next;
    });
  }

  function cycleChat() {
    setChatState((prev) => {
      const next: PanelState = prev === "normal" ? "expanded" : prev === "expanded" ? "minimized" : "normal";
      applyResize(sidebarState, next);
      return next;
    });
  }

  function enterFocusMode() {
    preFocusStates.current = { sb: sidebarState, ch: chatState };
    setSidebarState("minimized");
    setChatState("minimized");
    setIsFocusMode(true);
    applyResize("minimized", "minimized");
  }

  function exitFocusMode() {
    const { sb, ch } = preFocusStates.current;
    setSidebarState(sb);
    setChatState(ch);
    setIsFocusMode(false);
    applyResize(sb, ch);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isFocusMode) exitFocusMode();
    }
    function onToggle() {
      if (isFocusMode) exitFocusMode(); else enterFocusMode();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("aissistant:toggle-focus", onToggle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("aissistant:toggle-focus", onToggle);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocusMode, sidebarState, chatState]);

  return (
    <div ref={containerRef} className="h-full">
      <Allotment ref={allotmentRef}>

        {/* ── Sidebar / Explorer ── */}
        <Allotment.Pane preferredSize={SIDEBAR_NORMAL} minSize={MINIMIZED}>
          {sidebarState === "minimized" ? (
            <div
              className="h-full flex items-center justify-center border-r bg-sidebar-background cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={cycleSidebar}
              title="Show explorer"
            >
              <LayoutList className="h-4 w-4 text-muted-foreground" />
            </div>
          ) : (
            <div className="h-full flex flex-col border-r bg-sidebar-background overflow-hidden">
              <div className="flex items-center justify-start border-b px-2 py-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={cycleSidebar}
                  title={sidebarState === "normal" ? "Expand explorer" : "Minimize explorer"}
                >
                  {sidebarState === "normal" ? (
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  ) : (
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">{sidebar}</div>
            </div>
          )}
        </Allotment.Pane>

        {/* ── Editor ── */}
        <Allotment.Pane minSize={200}>
          <div className="h-full overflow-hidden">
            {isFocusMode ? (
              <div className="flex h-full justify-center overflow-auto bg-background">
                <div className="w-full max-w-3xl">
                  {editor}
                </div>
              </div>
            ) : editor}
          </div>
        </Allotment.Pane>

        {/* ── Chat ── */}
        <Allotment.Pane preferredSize={CHAT_NORMAL} minSize={MINIMIZED}>
          <div className="h-full relative">
            {/* Minimized placeholder — only visible when collapsed */}
            {chatState === "minimized" && (
              <div
                className="absolute inset-0 flex items-center justify-center border-l cursor-pointer hover:bg-accent/50 transition-colors z-10"
                onClick={cycleChat}
                title="Show chat"
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            {/* Chat panel — always mounted so state (messages, streaming) is preserved */}
            <div className={`flex h-full flex-col border-l${chatState === "minimized" ? " hidden" : ""}`}>
              <div className="flex items-center justify-end border-b px-2 py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={cycleChat}
                  title={chatState === "normal" ? "Expand chat to half screen" : "Minimize chat panel"}
                >
                  {chatState === "normal" ? (
                    <PanelRightOpen className="h-3.5 w-3.5" />
                  ) : (
                    <PanelRightClose className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">{chat}</div>
            </div>
          </div>
        </Allotment.Pane>

      </Allotment>
    </div>
  );
}
