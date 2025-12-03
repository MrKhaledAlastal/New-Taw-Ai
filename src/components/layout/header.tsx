'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';

export default function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 sm:h-16 sm:px-6">
      <SidebarTrigger className="sm:hidden" />
      {/* Page Title or other header content can go here */}
    </header>
  );
}
