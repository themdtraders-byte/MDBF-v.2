
"use client";

import React, { useEffect, useState } from "react";
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { dbLoad } from "@/lib/db";
import { Invoice } from "../ui/invoice";
import { useLanguage } from "@/hooks/use-language";
import { DateRangePicker } from "../ui/date-range-picker";
import { DateRange } from "react-day-picker";

type Supplier = {
    id: string;
    name: string;
    company?: string;
    contact: string;
    whatsapp?: string;
    address?: string;
    cnic?: string;
    balance: number;
    paymentTerms?: string;
    notes?: string;
    status: string;
    typeId?: string;
    photo?: string;
}
type BusinessProfile = { businessName: string, address: string, phone: string, [key: string]: any; };
type Purchase = { supplierId: string, billNumber: string, purchaseDate: string, grandTotal: number, amountPaid: number, items: { itemId: string, quantity: number }[] };
type Expense = { shopId: string, id: string, date: string, totalBill: number, amountPaid: number, notes?: string, categoryId: string, itemId?: string };
type InventoryItem = { id: string; name: string };
type ExpenseCategory = { id: string; name: string; items?: { id: string; name: string; }[] };
interface RowRange { start: number | null; end: number | null; }

interface SupplierDetailsProps {
    supplier: Supplier;
    isShopProfile?: boolean;
}

export function SupplierDetails({ supplier, isShopProfile = false }: SupplierDetailsProps) {
    const { t } = useLanguage();
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [allTransactions, setAllTransactions] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [rowRange, setRowRange] = useState<RowRange>({ start: null, end: null });

    useEffect(() => {
        const fetchData = async () => {
            const profileInfo = localStorage.getItem('dukaanxp-active-account');
            if(profileInfo) {
                const profiles = await dbLoad("profiles");
                const activeProfile = profiles.find(p => p.id === JSON.parse(profileInfo).id);
                setBusinessProfile(activeProfile || null);
            }

            const inventoryItems: InventoryItem[] = await dbLoad("inventory");
            setInventory(inventoryItems);

            if (isShopProfile) {
                const homeCategories: ExpenseCategory[] = await dbLoad("home-expense-categories");
                setExpenseCategories(homeCategories);
                const expenses: Expense[] = (await dbLoad("expenses")).filter(e => e.shopId === supplier.id);

                const getExpenseDescription = (expense: Expense) => {
                    const category = homeCategories.find(c => c.id === expense.categoryId);
                    const item = category?.items?.find(i => i.id === expense.itemId);
                    let desc = category?.name || "Expense";
                    if (item) desc += ` - ${item.name}`;
                    if (expense.notes) desc += ` (${expense.notes})`;
                    return desc;
                }

                const formattedExpenses = expenses.flatMap(e => {
                    const expenseDescription = getExpenseDescription(e);
                    let transactions = [];
                    if (e.totalBill > 0) {
                        transactions.push({ date: e.date, description: expenseDescription, debit: 0, credit: e.totalBill });
                    }
                    if (e.amountPaid > 0) {
                        transactions.push({ date: e.date, description: `Payment for Expense #${e.id.slice(-5)}`, debit: e.amountPaid, credit: 0 });
                    }
                    return transactions;
                });
                 setAllTransactions(formattedExpenses);

            } else {
                const purchases: Purchase[] = (await dbLoad("purchases")).filter(p => p.supplierId === supplier.id);
                
                const getItemSummary = (items: { itemId: string, quantity: number }[] = []) => {
                    return items.map(item => {
                        const itemName = inventoryItems.find(inv => inv.id === item.itemId)?.name || 'Item';
                        return `${itemName} (x${item.quantity})`;
                    }).join(', ');
                };

                const formattedPurchases = purchases.flatMap(p => {
                     const purchaseDescription = `Purchase #${p.billNumber}: ${getItemSummary(p.items)}`;
                     let transactions = [];
                     if (p.grandTotal > 0) {
                         transactions.push({ date: p.purchaseDate, description: purchaseDescription, debit: 0, credit: p.grandTotal });
                     }
                     if (p.amountPaid > 0) {
                          transactions.push({ date: p.purchaseDate, description: `Payment for #${p.billNumber}`, debit: p.amountPaid, credit: 0 });
                     }
                     return transactions;
                });
                setAllTransactions(formattedPurchases);
            }
        }
        fetchData();
    }, [supplier.id, isShopProfile]);
    
    const transactions = React.useMemo(() => {
        if (!dateRange?.from) return allTransactions;
        const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
        return allTransactions.filter(t => isWithinInterval(parseISO(t.date), interval));
    }, [allTransactions, dateRange]);
    
    const tableHeaders = [t('no.'), t('date'), t('description'), t('debit'), t('credit'), t('balance')];
    let runningBalance = 0;
    const allTableRows = transactions.map((tx, index) => {
        runningBalance += (tx.credit || 0) - (tx.debit || 0);
        return [
            index + 1,
            format(new Date(tx.date), "PPP"),
            tx.description,
            tx.debit ? tx.debit : '-',
            tx.credit ? tx.credit : '-',
            runningBalance
        ];
    });

    const finalTableRows = React.useMemo(() => {
        const start = rowRange.start !== null ? Math.max(1, rowRange.start) : 1;
        const end = rowRange.end !== null ? Math.min(allTableRows.length, rowRange.end) : allTableRows.length;

        if (start === 1 && end === allTableRows.length) {
            return allTableRows;
        }

        const visibleRows = allTableRows.slice(start - 1, end);
        const newRows = [];

        if (start > 1) {
            const previousRows = allTableRows.slice(0, start - 1);
            const totalDebit = previousRows.reduce((sum, row) => sum + (typeof row[3] === 'number' ? row[3] : 0), 0);
            const totalCredit = previousRows.reduce((sum, row) => sum + (typeof row[4] === 'number' ? row[4] : 0), 0);
            const closingBalance = previousRows.length > 0 ? previousRows[previousRows.length - 1][5] : 0;
            newRows.push([
                { value: `1-${start - 1}`, className: 'font-bold' },
                { value: 'Previous Entries Summary', className: 'font-bold' },
                '',
                { value: totalDebit, className: 'font-bold' },
                { value: totalCredit, className: 'font-bold' },
                { value: closingBalance, className: 'font-bold' },
            ]);
        }
        
        newRows.push(...visibleRows);

        if (end < allTableRows.length) {
            const subsequentRows = allTableRows.slice(end);
            const totalDebit = subsequentRows.reduce((sum, row) => sum + (typeof row[3] === 'number' ? row[3] : 0), 0);
            const totalCredit = subsequentRows.reduce((sum, row) => sum + (typeof row[4] === 'number' ? row[4] : 0), 0);
             newRows.push([
                { value: `${end + 1}-${allTableRows.length}`, className: 'font-bold' },
                { value: 'Subsequent Entries Summary', className: 'font-bold' },
                '',
                { value: totalDebit, className: 'font-bold' },
                { value: totalCredit, className: 'font-bold' },
                { value: '-', className: 'font-bold' },
            ]);
        }

        return newRows;

    }, [allTableRows, rowRange]);

    const summaryDetails = [
      { label: "Closing Balance:", value: `PKR ${runningBalance.toFixed(2)}`, isBalance: true, className: runningBalance > 0 ? "text-destructive" : "text-green-600" },
    ];
    
    const partyType = isShopProfile ? "Shop" : "Supplier";
    const title = isShopProfile ? "shopLedger" : "supplierLedger";
    const refType = isShopProfile ? "shopId" : "supplierId";

    return (
        <div>
            <Invoice
                title={title}
                businessProfile={businessProfile}
                party={{
                    name: supplier.name,
                    address: supplier.address,
                    contact: supplier.contact,
                    photo: supplier.photo,
                    type: partyType
                }}
                reference={{
                    number: supplier.id,
                    date: new Date().toISOString(),
                    type: t(refType as keyof any, { defaultValue: refType })
                }}
                table={{
                    headers: tableHeaders,
                    rows: finalTableRows,
                    footer: []
                }}
                paymentSummary={summaryDetails}
                status={supplier.balance <= 0 ? "Settled" : "Payable"}
                dateRangePicker={<DateRangePicker date={dateRange} setDate={setDateRange} />}
                dateRange={dateRange}
                rowRange={rowRange}
                setRowRange={setRowRange}
            />
        </div>
    )
}
