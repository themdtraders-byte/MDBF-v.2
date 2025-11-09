
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { useLanguage } from "@/hooks/use-language";
import { Icons } from "@/components/icons";
import { AddSupplierForm } from "@/components/suppliers/add-supplier-form";
import { SupplierListTable } from "@/components/suppliers/supplier-list-table";
import { PendingPayablesTable } from "@/components/suppliers/pending-payables-table";
import { ManageSupplierTypes } from "@/components/suppliers/manage-supplier-types";
import { SwipeableTabs, SwipeableTabsCarousel, SwipeableTabsContent, SwipeableTabsList, SwipeableTabsTrigger } from "@/components/ui/swipeable-tabs";

// Reusing supplier components as "Shops" for Home Profile
const TABS = [
    { value: "shop-list", icon: Icons.supplierList, label: "Shop List" },
    { value: "add-shop", icon: Icons.addSupplier, label: "Add Shop" },
    { value: "pending-payables", icon: Icons.pendingPayables, label: "Pending Payables" },
    { value: "manage-types", icon: Icons.tag, label: "Manage Shop Types" },
];

export default function ShopsPage() {
    const { t, dir } = useLanguage();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("shop-list");
    
    const handleFinish = () => {
        setActiveTab('shop-list');
        router.replace('/shops', { scroll: false });
    }

    return (
        <SidebarProvider>
            <Sidebar collapsible="icon" side={dir === 'rtl' ? 'right' : 'left'} className="group-data-[variant=floating]:bg-card group-data-[variant=sidebar]:bg-card">
                <SidebarNav />
            </Sidebar>
            <SidebarInset>
                <Header />
                <main className="p-4 sm:p-6">
                    <SwipeableTabs value={activeTab} onValueChange={setActiveTab}>
                        <SwipeableTabsList>
                             {TABS.map((tab) => (
                                <SwipeableTabsTrigger key={tab.value} value={tab.value}>
                                    <tab.icon className="mr-2" />
                                    {tab.label}
                                </SwipeableTabsTrigger>
                            ))}
                        </SwipeableTabsList>
                        <SwipeableTabsCarousel value={activeTab} onValueChange={setActiveTab}>
                            <SwipeableTabsContent value="shop-list">
                               <SupplierListTable isShopProfile={true} />
                            </SwipeableTabsContent>
                            <SwipeableTabsContent value="add-shop">
                               <AddSupplierForm onFinish={handleFinish} isShopProfile={true} />
                            </SwipeableTabsContent>
                            <SwipeableTabsContent value="pending-payables">
                                <PendingPayablesTable isShopProfile={true} />
                            </SwipeableTabsContent>
                            <SwipeableTabsContent value="manage-types">
                               <ManageSupplierTypes isShopProfile={true} />
                            </SwipeableTabsContent>
                        </SwipeableTabsCarousel>
                    </SwipeableTabs>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
