"use client";

import type { ReactNode } from "react";
import Header from "@/components/layout/header";
import MainSidebar from "@/components/layout/main-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useLanguage } from "@/hooks/use-language";
import { useEffect } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { dir } = useLanguage();

  useEffect(() => {
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <SidebarProvider>
      <MainSidebar />
      <div
        className="flex flex-col w-full min-h-dvh md:h-screen overflow-hidden transition-[margin] duration-200"
        style={
          dir === "rtl"
            ? ({ marginRight: "var(--sidebar-offset)" } as React.CSSProperties)
            : ({ marginLeft: "var(--sidebar-offset)" } as React.CSSProperties)
        }
      >
        {/* <Header /> */}
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </div>
    </SidebarProvider>
  );
}
