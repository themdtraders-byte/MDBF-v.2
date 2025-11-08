
"use client";

import React, { useEffect, useState } from "react";
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { dbLoad } from "@/lib/db";
import { Invoice } from "../ui/invoice";
import { useLanguage } from "@/hooks/use-language";
import { DateRangePicker } from "../ui/date-range-picker";
import { DateRange } from "react-day-picker";

type Customer = {
    id: string;
    name: string;
    company?: string;
    contact: string;
    whatsapp?: string;
    address?: string;
    cnic?: string;
    balance: number;
    creditLimit?: number;
    notes?: string;
    status: string;
    typeId?: string;
    photo?: string;
}
type BusinessProfile = { businessName: string, address: string, phone: string, [key: string]: any; };
type Sale = { customerId: string, invoiceNumber: string, invoiceDate: string, grandTotal: number, amountReceived: number, items: { itemId: string, quantity: number }[] };
type InventoryItem = { id: string; name: string };
interface RowRange { start: number | null; end: number | null; }

export function CustomerDetails({ customer }: { customer: Customer }) {
    const { t } = useLanguage();
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [allTransactions, setAllTransactions] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [rowRange, setRowRange] = useState<RowRange>({ start: null, end: null });

    useEffect(() => {
        const fetchData = async () => {
            const profiles = await dbLoad("profiles");
            const activeProfileInfo = localStorage.getItem('dukaanxp-active-account');
            if (activeProfileInfo) {
                const activeProfileId = JSON.parse(activeProfileInfo).id;
                const activeProfile = profiles.find(p => p.id === activeProfileId);
                setBusinessProfile(activeProfile || null);
            }

            const inventoryItems: InventoryItem[] = await dbLoad("inventory");
            setInventory(inventoryItems);

            const sales: Sale[] = (await dbLoad("sales")).filter(s => s.customerId === customer.id);
            
            const getItemSummary = (items: { itemId: string, quantity: number }[] = []) => {
                return items.map(item => {
                    const itemName = inventoryItems.find(inv => inv.id === item.itemId)?.name || 'Item';
                    return `${itemName} (x${item.quantity})`;
                }).join(', ');
            };

            const formattedSales = sales.flatMap(s => {
                const saleDescription = `Sale #${s.invoiceNumber}: ${getItemSummary(s.items)}`;
                let transactions = [];
                if (s.grandTotal > 0) {
                    transactions.push({
                        date: s.invoiceDate,
                        description: saleDescription,
                        debit: s.grandTotal,
                        credit: 0
                    });
                }
                if (s.amountReceived > 0) {
                     transactions.push({
                        date: s.invoiceDate,
                        description: `Payment for #${s.invoiceNumber}`,
                        debit: 0,
                        credit: s.amountReceived
                    });
                }
                return transactions;
            });

            setAllTransactions(formattedSales);
        };
        fetchData();
    }, [customer.id]);

    const transactions = React.useMemo(() => {
        if (!dateRange?.from) return allTransactions;
        const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
        return allTransactions.filter(t => isWithinInterval(parseISO(t.date), interval));
    }, [allTransactions, dateRange]);


    const tableHeaders = [t('no.'), t('date'), t('description'), t('debit'), t('credit'), t('balance')];
    
    let runningBalance = 0;
    const allTableRows = transactions.map((tx, index) => {
        runningBalance += (tx.debit || 0) - (tx.credit || 0);
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

        // Previous entries summary
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

        // Subsequent entries summary
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
    
    return (
        <div>
            <Invoice
                title="customerLedger"
                businessProfile={businessProfile}
                party={{
                    name: customer.name,
                    address: customer.address,
                    contact: customer.contact,
                    photo: customer.photo,
                    type: "Customer"
                }}
                reference={{
                    number: customer.id,
                    date: new Date().toISOString(),
                    type: t('customerId')
                }}
                table={{
                    headers: tableHeaders,
                    rows: finalTableRows,
                    footer: []
                }}
                paymentSummary={summaryDetails}
                status={customer.balance <= 0 ? "Settled" : "Due"}
                dateRangePicker={<DateRangePicker date={dateRange} setDate={setDateRange} />}
                dateRange={dateRange}
                rowRange={rowRange}
                setRowRange={setRowRange}
            />
       </div>
    )
}
