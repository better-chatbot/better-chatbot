"use client";

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenu,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "ui/dropdown-menu";
import { AvatarFallback, AvatarImage, Avatar } from "ui/avatar";
import { SidebarMenuButton, SidebarMenuItem, SidebarMenu } from "ui/sidebar";
import {
  ChevronsUpDown,
  Command,
  LogOutIcon,
  Settings2,
  Palette,
  Languages,
  Sun,
  MoonStar,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { appStore } from "@/app/store";
import { BASE_THEMES, COOKIE_KEY_LOCALE, SUPPORTED_LOCALES } from "lib/const";
import { capitalizeFirstLetter, cn } from "lib/utils";
import { authClient } from "auth/client";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { getLocaleAction } from "@/i18n/get-locale";
import { useCallback } from "react";
import { GithubIcon } from "ui/github-icon";
import { DiscordIcon } from "ui/discord-icon";
import { useThemeStyle } from "@/hooks/use-theme-style";
import { Session, User } from "better-auth";

export function AppSidebarUser({
  session,
}: { session?: { session: Session; user: User } }) {
  const appStoreMutate = appStore((state) => state.mutate);
  const t = useTranslations("Layout");

  const user = session?.user;

  const logout = () => {
    authClient.signOut().finally(() => {
      window.location.href = "/sign-in";
    });
  };

  useSWR(
    "/session-update",
    () =>
      authClient.getSession().then(() => {
        console.log(`session-update: ${new Date().toISOString()}`);
      }),
    {
      refreshIntervalOnFocus: false,
      focusThrottleInterval: 1000 * 60 * 5,
      revalidateOnFocus: false,
      refreshWhenHidden: true,
      refreshInterval: 1000 * 60 * 5,
    },
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground bg-input/30 border"
              size={"lg"}
            >
              <Avatar className="rounded-full size-8 border">
                <AvatarImage
                  className="object-cover"
                  src={user?.image || "/pf.png"}
                  alt={user?.name || ""}
                />
                <AvatarFallback>{user?.name?.slice(0, 1) || ""}</AvatarFallback>
              </Avatar>
              <span className="truncate">{user?.email}</span>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            className="bg-background w-[--radix-dropdown-menu-trigger-width] min-w-60 rounded-lg"
            align="center"
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  <AvatarImage
                    src={user?.image || "/pf.png"}
                    alt={user?.name || ""}
                  />
                  <AvatarFallback className="rounded-lg">
                    {user?.name?.slice(0, 1) || ""}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user?.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => appStoreMutate({ openChatPreferences: true })}
            >
              <Settings2 className="size-4 text-foreground" />
              <span>{t("chatPreferences")}</span>
            </DropdownMenuItem>
            <SelectTheme />
            <SelectLanguage />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => appStoreMutate({ openShortcutsPopup: true })}
            >
              <Command className="size-4 text-foreground" />
              <span>{t("keyboardShortcuts")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                window.open(
                  "https://github.com/better-chatbot/better-chatbot/issues/new",
                  "_blank",
                );
              }}
            >
              <GithubIcon className="size-4 fill-foreground" />
              <span>{t("reportAnIssue")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                window.open("https://discord.gg/gCRu69Upnp", "_blank");
              }}
            >
              <DiscordIcon className="size-4 fill-foreground" />
              <span>{t("joinCommunity")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer">
              <LogOutIcon className="size-4 text-foreground" />
              <span>{t("signOut")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SelectTheme() {
  const t = useTranslations("Layout");

  const { theme = "light", setTheme } = useTheme();

  const { themeStyle = "default", setThemeStyle } = useThemeStyle();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        className="flex items-center"
        icon={
          <>
            <span className="text-muted-foreground text-xs min-w-0 truncate">
              {`${capitalizeFirstLetter(theme)} ${capitalizeFirstLetter(
                themeStyle,
              )}`}
            </span>
            <ChevronRight className="size-4 ml-2" />
          </>
        }
      >
        <Palette className="mr-2 size-4" />
        <span className="mr-auto">{t("theme")}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-48">
          <DropdownMenuLabel className="text-muted-foreground w-full flex items-center">
            <span className="text-muted-foreground text-xs mr-2 select-none">
              {capitalizeFirstLetter(theme)}
            </span>
            <div className="flex-1" />

            <div
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="cursor-pointer border rounded-full flex items-center"
            >
              <div
                className={cn(
                  theme === "dark" &&
                    "bg-accent ring ring-muted-foreground/40 text-foreground",
                  "p-1 rounded-full",
                )}
              >
                <MoonStar className="size-3" />
              </div>
              <div
                className={cn(
                  theme === "light" &&
                    "bg-accent ring ring-muted-foreground/40 text-foreground",
                  "p-1 rounded-full",
                )}
              >
                <Sun className="size-3" />
              </div>
            </div>
          </DropdownMenuLabel>
          <div className="max-h-96 overflow-y-auto">
            {BASE_THEMES.map((t) => (
              <DropdownMenuCheckboxItem
                key={t}
                checked={themeStyle === t}
                onClick={(e) => {
                  e.preventDefault();
                  setThemeStyle(t);
                }}
                className="text-sm"
              >
                {capitalizeFirstLetter(t)}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}

function SelectLanguage() {
  const t = useTranslations("Layout");
  const { data: currentLocale } = useSWR(COOKIE_KEY_LOCALE, getLocaleAction, {
    fallbackData: SUPPORTED_LOCALES[0].code,
    revalidateOnFocus: false,
  });
  const handleOnChange = useCallback((locale: string) => {
    document.cookie = `${COOKIE_KEY_LOCALE}=${locale}; path=/;`;
    window.location.reload();
  }, []);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages className="mr-2 size-4" />
        <span>{t("language")}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-48 max-h-96 overflow-y-auto">
          <DropdownMenuLabel className="text-muted-foreground">
            {t("language")}
          </DropdownMenuLabel>
          {SUPPORTED_LOCALES.map((locale) => (
            <DropdownMenuCheckboxItem
              key={locale.code}
              checked={locale.code === currentLocale}
              onCheckedChange={() =>
                locale.code !== currentLocale && handleOnChange(locale.code)
              }
            >
              {locale.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
