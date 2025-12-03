"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue } from "react";
import Image from "next/image";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useTheme } from "next-themes";
import { useLanguage } from "@/hooks/use-language";
import { useIsMobile } from "@/hooks/use-mobile";
import { createChat, deleteChat, renameChat } from "@/lib/firestore";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { translations } from "@/lib/translations";
import {
  Edit2,
  Ellipsis,
  LogOut,
  Menu,
  Moon,
  MoreVertical,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";

type ChatPreview = {
  id: string;
  title: string;
  lastMessagePreview?: string;
};

const THEME_OPTIONS = [
  {
    value: "light",
    label: "Light",
    icon: <Sun className="h-4 w-4" />,
    compactIcon: (
      <span className="flex h-8 w-8 items-center justify-center rounded-full text-base">
        ☀
      </span>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: <Moon className="h-4 w-4" />,
    compactIcon: (
      <span className="flex h-8 w-8 items-center justify-center rounded-full text-base">
        ☾
      </span>
    ),
  },
] as const;

const LANGUAGE_OPTIONS = [
  {
    value: "en",
    label: "English",
    icon: (
      <span className="flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-black uppercase">
        EN
      </span>
    ),
    compactIcon: (
      <span className="flex h-8 w-8 items-center justify-center rounded-full text-[0.65rem] font-black uppercase">
        EN
      </span>
    ),
  },
  {
    value: "ar",
    label: "العربية",
    icon: (
      <span className="flex h-5 w-5 items-center justify-center rounded-full text-base font-black">
        ع
      </span>
    ),
    compactIcon: (
      <span className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-black">
        ع
      </span>
    ),
  },
] as const;

export default function MainSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn } = useAuth();
  const { lang, setLanguage } = useLanguage();
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const t = translations[lang as keyof typeof translations];

  // Mobile off-canvas state
  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile = () => setMobileOpen(true);
  const closeMobile = () => setMobileOpen(false);

  // Claude-style collapse
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState("");
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const activeChatId = searchParams.get("chatId");

  const sidebarWidth = isMobile ? 320 : isCollapsed ? 64 : 280;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (isMobile) {
      root.style.setProperty("--sidebar-offset", "0px");
    } else {
      root.style.setProperty("--sidebar-offset", `${sidebarWidth}px`);
    }

    return () => {
      root.style.setProperty("--sidebar-offset", "0px");
    };
  }, [isMobile, sidebarWidth]);

  const handleLogoClick = () => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  };

  const handleCollapseClick = () => {
    if (isMobile) {
      closeMobile();
      return;
    }

    setIsCollapsed(true);
  };

  const handleOpenSettings = () => {
    router.push("/settings");
    closeMobile();
  };

  // لو الشاشة مش موبايل، سكّر overlay تبع الموبايل
  useEffect(() => {
    if (!isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile]);

  // Body scroll lock لما السايد تفتح على الموبايل
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Listen to chats من Firestore
  useEffect(() => {
    if (!user?.uid) {
      setChats([]);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "chats"),
      orderBy("lastMessageAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setChats(
        snap.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || "New chat",
          lastMessagePreview: doc.data().lastMessagePreview,
        }))
      );
    });

    return () => unsub();
  }, [user?.uid]);

  const filteredChats = useMemo(() => {
    if (!deferredSearchTerm.trim()) return chats;
    const lower = deferredSearchTerm.toLowerCase();
    return chats.filter((chat) => chat.title.toLowerCase().includes(lower));
  }, [chats, deferredSearchTerm]);

  const handleNewChat = async () => {
    if (!user?.uid) {
      router.push("/login");
      return;
    }

    try {
      setIsCreatingChat(true);
      // لو حابب تنشئ الوثيقة فعلياً هنا
      const chatId = await createChat(user.uid);
      router.push(`/chat?chatId=${chatId}`);
    } catch (error) {
      console.error("Error creating chat:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create a new chat.",
      });
    } finally {
      setIsCreatingChat(false);
      closeMobile();
    }
  };

  const handleOpenChat = useCallback(
    (id: string) => {
      router.push(`/chat?chatId=${id}`);
      closeMobile();
    },
    [router]
  );

  const handleDeleteChat = async (chatId: string) => {
    if (!user?.uid) return;
    try {
      await deleteChat(user.uid, chatId);
      toast({
        title: "Chat deleted",
        description: "The conversation has been deleted.",
      });
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete chat.",
      });
    }
  };

  const handleRenameChat = async () => {
    if (!user?.uid || !renamingChatId || !tempTitle.trim()) return;
    try {
      await renameChat(user.uid, renamingChatId, tempTitle.trim());
      setRenamingChatId(null);
      setTempTitle("");
      setIsRenameDialogOpen(false);
      toast({
        title: "Chat renamed",
        description: "The conversation has been renamed.",
      });
    } catch (error) {
      console.error("Error renaming chat:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to rename chat.",
      });
    }
  };

  const handleOpenRenameDialog = (chatId: string, chatTitle: string) => {
    setRenamingChatId(chatId);
    setTempTitle(chatTitle);
    setIsRenameDialogOpen(true);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <>
      <button
        onClick={openMobile}
        aria-label="Open sidebar"
        className={cn(
          "fixed top-4 left-4 z-50 p-2 rounded-md bg-black/60 backdrop-blur-md text-white md:hidden"
        )}
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
          onClick={closeMobile}
        />
      )}

      <aside
        aria-label="Sidebar"
        className={cn(
          "relative h-[100dvh] md:h-screen shrink-0 border-r border-background bg-background flex flex-col shadow-[0_20px_80px_rgba(0,0,0,0.35)]",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:sticky md:top-0 md:flex md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{
          width: sidebarWidth,
          transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          overflow: isMobile ? "auto" : "hidden",
        }}
      >
        <div
          className="flex items-center justify-between px-3 py-3"
          style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.5)" }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogoClick}
              className={cn(
                "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg group/logo transition-all",
                isCollapsed ? "cursor-pointer" : "cursor-default"
              )}
              aria-label={isCollapsed ? "Open sidebar" : t.appName}
            >
              <Image
                src="/logo.png"
                alt={t.appName}
                fill
                sizes="36px"
                className="object-contain"
                priority
              />
              {isCollapsed && (
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-950/80 text-white opacity-0 transition-opacity group-hover/logo:opacity-100">
                  <PanelLeft size={16} />
                </span>
              )}
            </button>
          </div>
          {!isCollapsed && (
            <button
              onClick={handleCollapseClick}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
              aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
            >
              <PanelLeft size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-col px-2 pt-3 gap-px">
          <div className="relative group">
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isCreatingChat}
              className={cn(
                "inline-flex items-center justify-center relative w-full gap-3 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-slate-100 border border-transparent",
                "transition duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] active:scale-[0.985] hover:bg-white/5 active:bg-white/10",
                isCreatingChat && "opacity-70 cursor-not-allowed"
              )}
            >
              <div className="-translate-x-1 w-full flex flex-row items-center justify-start gap-3">
                <div className="flex items-center justify-center text-white">
                  <div className="flex items-center justify-center rounded-full size-[1.5rem] bg-primary text-primary-foreground border border-white/10 shadow-sm group-hover:-rotate-3 group-hover:scale-105 group-active:rotate-3 group-active:scale-[0.98] transition-all duration-150 ease-in-out">
                    <Plus size={20} className="shrink-0 text-white" />
                  </div>
                </div>
                <span className="truncate text-sm whitespace-nowrap flex-1 text-left">
                  <span
                    className="transition-all duration-200"
                    style={{
                      opacity: isCollapsed ? 0 : 1,
                      width: isCollapsed ? 0 : "auto",
                      display: "inline-block",
                    }}
                  >
                    {isCreatingChat ? t.loading : t.newChat}
                  </span>
                </span>
              </div>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {!isCollapsed && (
            <div className="flex flex-col flex-1 overflow-hidden px-2">
              <div className="flex items-center justify-between pt-4 pb-2 group/header">
                <h3 className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  {t.recentChats}
                </h3>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={t.searchChats}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg bg-background border border-white/5 px-9 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <ul className="flex-1 overflow-y-auto space-y-1 pb-3 pe-2 md:pe-0">
                {filteredChats.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-slate-500 bg-background/30 rounded-lg">
                    {t.noChatsFound}
                  </li>
                ) : (
                  filteredChats.map((chat) => (
                    <RecentChatButton
                      key={chat.id}
                      id={chat.id}
                      title={chat.title}
                      preview={chat.lastMessagePreview}
                      active={activeChatId === chat.id}
                      collapsed={isCollapsed}
                      onClick={() => handleOpenChat(chat.id)}
                      onDelete={() => handleDeleteChat(chat.id)}
                      onRenameStart={() =>
                        handleOpenRenameDialog(chat.id, chat.title)
                      }
                    />
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        <div
          className="mt-auto w-full px-3 py-2 space-y-2"
          style={{ borderTop: "1px solid rgba(51, 65, 85, 0.5)" }}
        >


          {isLoggedIn && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2.5 rounded-lg px-0 py-2 transition-all group">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/10 group-hover:scale-[1.05] transition-transform duration-300">
                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || t.appName} />
                    <AvatarFallback className="bg-accent/30 text-sm font-semibold">
                      {user.displayName?.slice(0, 2)?.toUpperCase() ||
                        user.email?.slice(0, 2)?.toUpperCase() ||
                        "UA"}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className="flex-1 min-w-0 text-left overflow-hidden"
                    style={{
                      opacity: isCollapsed ? 0 : 1,
                      transition: "opacity 150ms ease-in-out",
                      width: isCollapsed ? 0 : "auto",
                    }}
                  >
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {user.displayName || "User"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {user.email}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-72 bg-background border border-border/60 text-foreground"
              >
                <div className="space-y-4 p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={user.photoURL || undefined} />
                      <AvatarFallback className="bg-accent/30 text-base">
                        {user.displayName?.[0] || user.email?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {user.displayName || "User"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t.theme}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {THEME_OPTIONS.map(({ value, label, icon }) => (
                        <ControlButton
                          key={value}
                          icon={icon}
                          label={label}
                          active={theme === value}
                          collapsed={false}
                          onClick={() => setTheme(value)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t.language}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {LANGUAGE_OPTIONS.map(({ value, label, icon }) => (
                        <ControlButton
                          key={value}
                          icon={icon}
                          label={label}
                          active={lang === value}
                          collapsed={false}
                          onClick={() => setLanguage(value as "en" | "ar")}
                        />
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleLogout}
                    className="w-full bg-accent/15 text-foreground hover:bg-accent/30"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {t.logout}
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className={cn(
                "w-full rounded-2xl border border-white/5 bg-background py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/70 transition-all",
                isCollapsed && "w-full h-10 flex items-center justify-center p-0"
              )}
            >
              {isCollapsed ? "→" : t.login}
            </button>
          )}
        </div>

        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
          <DialogContent className="bg-background border border-border/60 text-foreground">
            <DialogHeader>
              <DialogTitle>{t.renameChat}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                placeholder={t.chatName}
                className="bg-accent/5 border border-border/50 text-foreground placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameChat();
                  } else if (e.key === "Escape") {
                    setIsRenameDialogOpen(false);
                  }
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsRenameDialogOpen(false)}
                className="border-border/60 text-foreground hover:bg-accent/10"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleRenameChat}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {t.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </aside>
    </>
  );
}

function RecentChatButton({
  id,
  title,
  preview,
  active,
  collapsed,
  onClick,
  onDelete,
  onRenameStart,
}: {
  id: string;
  title: string;
  preview?: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRenameStart: () => void;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center justify-center relative shrink-0 select-none",
          "border-transparent transition-all font-normal duration-150 ease-in-out",
          "h-8 rounded-lg px-3 min-w-[4rem] active:scale-[0.985] whitespace-nowrap text-xs w-full overflow-hidden",
          "group py-1.5 px-4 hover:bg-accent/50 active:bg-accent active:scale-100",
          active && "bg-accent",
          collapsed && "px-2 min-w-0 justify-center"
        )}
      >
        <div
          className={cn(
            "flex flex-row items-center justify-start gap-3 w-full transition-transform duration-200 ease-in-out",
            collapsed ? "" : "-translate-x-2"
          )}
        >
          {!collapsed && (
            <span
              className={cn(
                "truncate text-sm whitespace-nowrap flex-1 text-left transition-all duration-150",
                "group-hover:[mask-image:linear-gradient(to_right,black_78%,transparent_95%)]",
                active &&
                "[mask-image:linear-gradient(to_right,black_78%,transparent_95%)]"
              )}
            >
              {title}
            </span>
          )}
        </div>
      </button>

      {/* زر الـ ... مثل Claude مع Dropdown فعلي */}
      {!collapsed && (
        <div
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 transition-opacity duration-200 ease-in-out",
            active
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 pointer-events-auto"
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-8 w-8 rounded-md active:scale-95 hover:bg-accent/40 transition-all duration-150 flex items-center justify-center"
                aria-label={`More options for ${title}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-background border border-border/60 text-foreground"
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameStart();
                }}
                className="cursor-pointer hover:bg-accent/20"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="cursor-pointer hover:bg-accent/20 text-red-500"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// Control Button (Theme / Language)
function ControlButton({
  icon,
  compactIcon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: React.ReactNode;
  compactIcon?: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const iconNode = collapsed && compactIcon ? compactIcon : icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center rounded-2xl border text-sm font-semibold tracking-wide transition-all",
        active
          ? "border-accent bg-accent/30 text-foreground shadow"
          : "border-border/60 text-muted-foreground hover:border-accent hover:bg-accent/10",
        collapsed
          ? "h-11 w-11 justify-center p-0"
          : "w-full justify-start gap-3 px-4 py-2.5"
      )}
      aria-label={label}
    >
      <span className="flex items-center justify-center">{iconNode}</span>
      {!collapsed && <span>{label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-4 whitespace-nowrap rounded-lg bg-black/90 px-3 py-2 text-xs opacity-0 transition-opacity group-hover:opacity-100 z-50">
          {label}
        </span>
      )}
    </button>
  );
}
