
"use client";

import { useEffect, useState } from "react";
import { dbLoad } from "@/lib/db";
import { Invoice } from "../ui/invoice";

type Account = { id: string; name: string };
type BusinessProfile = { businessName: string, address: string, phone: string, [key: string]: any; };
type ExpenseCategory = { id: string; name: string; items?: {id: string; name: string}[] };

type Expense = {
    id: string;
    categoryId: string;
    itemId?: string;
    date: string;
    amount: number;
    paymentAccountId?: string;
    notes?: string;
    reference?: string;
    attachments?: string[];
};

interface ExpenseDetailsProps {
    expense: Expense;
}

export function ExpenseDetails({ expense }: ExpenseDetailsProps) {
    const [account, setAccount] = useState<Account | null>(null);
    const [category, setCategory] = useState<ExpenseCategory | null>(null);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const activeAccountInfo = localStorage.getItem('dukaanxp-active-account');
            let profileId: string | null = null;
            let profileType: string = 'Business';

            if(activeAccountInfo) {
                const parsedInfo = JSON.parse(activeAccountInfo);
                profileId = parsedInfo.id;
                profileType = parsedInfo.type;

                const profiles = await dbLoad("profiles");
                const activeProfile = profiles.find(p => p.id === profileId);
                setBusinessProfile(activeProfile || null);
            }

            if (expense.paymentAccountId) {
                const accounts = await dbLoad("accounts");
                setAccount(accounts.find(a => a.id === expense.paymentAccountId) || null);
            }

            const categoryDbKey = profileType === 'Home' ? 'home-expense-categories' : 'business-expense-categories';
            const categories = await dbLoad(categoryDbKey);
            setCategory(categories.find(c => c.id === expense.categoryId) || null);
        }
        fetchData();
    }, [expense]);

    
    const getItemName = (categoryId: string, itemId?: string) => {
        if (!itemId || !category) return '';
        return category.items?.find(i => i.id === itemId)?.name || '';
    }

    const itemName = getItemName(expense.categoryId, expense.itemId);
    
    const tableHeaders = ['Description', 'Category', 'Amount'];
    const tableRows = [
        [
            `${itemName ? `${itemName} - ` : ''}${expense.notes || 'General Expense'}`,
            category?.name || 'Uncategorized',
            `PKR ${expense.amount.toFixed(2)}`
        ]
    ];

    const summaryDetails = [
        { label: "grandTotal:", value: `PKR ${expense.amount.toFixed(2)}`, isGrand: true },
        { label: "Paid From:", value: account?.name || 'N/A' },
    ];

    return (
       <div>
            <Invoice
                title="expenseVoucher"
                businessProfile={businessProfile}
                party={{
                    name: "Expense Record",
                    type: "Worker" // Generic type, can be improved
                }}
                reference={{
                    number: expense.reference || expense.id,
                    date: expense.date,
                    type: 'Reference ID'
                }}
                table={{
                    headers: tableHeaders,
                    rows: tableRows,
                    footer: []
                }}
                paymentSummary={summaryDetails}
                status="Paid"
                attachments={expense.attachments}
            />
       </div>
    );
}
