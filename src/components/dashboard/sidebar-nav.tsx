"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Icons } from "@/components/icons";
import { useLanguage } from "@/hooks/use-language";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../theme-toggle";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { Briefcase, Factory, Home, Store, Warehouse } from "lucide-react";

const businessNavItems = [
  { href: "/", icon: Icons.dashboard, label: "dashboard" },
  { href: "/sales", icon: Icons.sales, label: "sales" },
  { href: "/purchases", icon: Icons.purchases, label: "purchases" },
  { href: "/expenses", icon: Icons.expenses, label: "expenses" },
  { href: "/inventory", icon: Icons.inventory, label: "inventory" },
  { href: "/production", icon: Icons.production, label: "production" },
  { href: "/accounts", icon: Icons.accounts, label: "accounts" },
  { href: "/customers", icon: Icons.customers, label: "customers" },
  { href: "/suppliers", icon: Icons.suppliers, label: "suppliers" },
  { href: "/workers", icon: Icons.workers, label: "workers" },
  { href: "/reports", icon: Icons.reports, label: "reports" },
  { href: "/trash", icon: Icons.trash, label: "trash" },
  { href: "/settings", icon: Icons.settings, label: "settings" },
];

const homeNavItems = [
    { href: "/", icon: Icons.dashboard, label: "dashboard" },
    { href: "/expenses", icon: Icons.expenses, label: "expenses" },
    { href: "/shops", icon: Icons.store, label: "Shops" },
    { href: "/reports", icon: Icons.reports, label: "reports" },
    { href: "/trash", icon: Icons.trash, label: "trash" },
    { href: "/settings", icon: Icons.settings, label: "settings" },
];

const businessTypeIcons = {
  shop: Store,
  factory: Factory,
  wholesale: Warehouse,
  default: Briefcase,
};


export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [activeAccount, setActiveAccount] = useState<any>(null);

  useEffect(() => {
    const account = localStorage.getItem('dukaanxp-active-account');
    if(account) {
      setActiveAccount(JSON.parse(account));
    }
  }, []);

  const getInitials = (name: string) => {
    if (!name) return "";
    const words = name.split(' ');
    if (words.length > 1) {
      return words[0][0] + words[words.length - 1][0];
    }
    return name.substring(0, 2);
  }
  
  const handleSwitchAccount = () => {
      router.push('/select-account');
  }

  const navItems = activeAccount?.type === 'Home' ? homeNavItems : businessNavItems;

  const getProfileIcon = () => {
    if (activeAccount?.logo) {
      return <AvatarImage src={activeAccount.logo} alt="Business Logo" />;
    }
    if (activeAccount?.type === 'Home') {
      return <Home className="h-6 w-6 text-primary" />;
    }
    if (activeAccount?.type === 'Business' && activeAccount?.businessType) {
      const Icon = businessTypeIcons[activeAccount.businessType as keyof typeof businessTypeIcons] || businessTypeIcons.default;
      return <Icon className="h-6 w-6 text-primary" />;
    }
    return <AvatarFallback>{getInitials(activeAccount?.name || 'MD')}</AvatarFallback>;
  };


  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Icons.logo className="size-8 text-primary" />
          <span className="text-lg font-semibold group-data-[state=collapsed]:group-data-[collapsible=icon]:hidden">{t("dukaanxp")}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={t(item.label as keyof any)}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label === 'Shops' ? item.label : t(item.label as keyof any)}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 flex items-center justify-center bg-muted">
                {getProfileIcon()}
            </Avatar>
            <div className="overflow-hidden grow group-data-[state=collapsed]:group-data-[collapsible=icon]:hidden">
                <p className="font-semibold truncate">{activeAccount?.name || "MD Business Flow"}</p>
                <p className="text-xs text-muted-foreground truncate">{activeAccount?.ownerName || "M. Danial Abubakar"}</p>
            </div>
             <div className="group-data-[state=collapsed]:group-data-[collapsible=icon]:hidden">
                <ThemeToggle />
            </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleSwitchAccount} className="mt-2 group-data-[state=collapsed]:group-data-[collapsible=icon]:hidden">
            Switch Account
        </Button>
      </SidebarFooter>
    </>
  );
}
