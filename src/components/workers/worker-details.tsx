
"use client";

import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, getDaysInMonth, isSameMonth, isBefore, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { dbLoad } from "@/lib/db";
import { Invoice } from "../ui/invoice";
import { useLanguage } from "@/hooks/use-language";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkerAttendanceCalendar } from "./worker-attendance-calendar";
import { DateRangePicker } from "../ui/date-range-picker";
import { DateRange } from "react-day-picker";

type Worker = {
    id: string;
    name: string;
    fatherName?: string;
    contact: string;
    address?: string;
    cnic?: string;
    joiningDate: string | Date;
    workType: "salary" | "work_based";
    salary?: number;
    productionRates?: { itemId: string; rate: number }[];
    status: string;
    role?: string;
    notes?: string;
    allowedLeaves?: number;
}
type BusinessProfile = { businessName: string, address: string, phone: string, [key: string]: any; };
type SalaryTransaction = { workerId: string, date: string, type: 'salary' | 'advance' | 'work_payment' | 'daily_expense' | 'tip' | 'penalty' | 'adjustment', amount: number, notes?: string };
type ProductionBatch = {
    batchCode: string;
    productionDate: string;
    finishedGoods: { itemId: string; quantity: number }[];
    laborCosts?: { workerId: string; quantity: number; cost: number; }[];
};
type Item = { id: string; name: string };
type AttendanceRecord = {
    workerId: string;
    date: string; // yyyy-MM-dd
    status: 'p' | 'a' | 'l';
};

interface RowRange { start: number | null; end: number | null; }

interface WorkerDetailsProps {
    worker: Worker;
}

export function WorkerDetails({ worker }: WorkerDetailsProps) {
    const { t } = useLanguage();
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [allTransactions, setAllTransactions] = useState<any[]>([]);
    const [inventory, setInventory] = useState<Item[]>([]);
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
            
            const inventoryItems: Item[] = await dbLoad("inventory");
            setInventory(inventoryItems);

            const salaryTxs: SalaryTransaction[] = (await dbLoad("salary-transactions")).filter(s => s.workerId === worker.id);
            const allProductionHistory: ProductionBatch[] = await dbLoad("production-history");
            const workerAttendance: AttendanceRecord[] = (await dbLoad("attendance")).filter(a => a.workerId === worker.id);
            
            let txs: any[] = [];
            
            salaryTxs.forEach(s => {
                const isDebit = s.type === 'salary' || s.type === 'advance' || s.type === 'daily_expense' || s.type === 'penalty' || (s.type === 'adjustment' && s.amount > 0); // Note: positive adjustment is a credit, but from company POV it's a debit to worker's balance
                const isCredit = s.type === 'tip' || (s.type === 'adjustment' && s.amount < 0);
                
                 txs.push({
                    date: s.date,
                    description: `${s.type.charAt(0).toUpperCase() + s.type.slice(1).replace('_', ' ')}: ${s.notes || ''}`,
                    debit: isDebit ? Math.abs(s.amount) : 0,
                    credit: isCredit ? Math.abs(s.amount) : 0,
                });
            });

            if (worker.workType === 'work_based') {
                const productionEarnings = allProductionHistory.flatMap(batch => 
                    (batch.laborCosts || [])
                        .filter(lc => lc.workerId === worker.id)
                        .map(lc => {
                            const finishedGood = batch.finishedGoods[0]; // Assuming one FG per batch for simplicity
                            const itemName = inventoryItems.find(i => i.id === finishedGood?.itemId)?.name || 'Product';
                            return {
                                date: batch.productionDate,
                                description: `Work on batch ${batch.batchCode}: Produced ${itemName} (x${lc.quantity})`,
                                debit: 0,
                                credit: lc.cost,
                            }
                        })
                );
                txs.push(...productionEarnings);
            } else { 
                const joinDateValue = typeof worker.joiningDate === 'string' ? parseISO(worker.joiningDate) : worker.joiningDate;
                if (isBefore(joinDateValue, new Date())) {
                     const months = eachMonthOfInterval({ start: joinDateValue, end: new Date() });
                     months.forEach(monthStart => {
                        const daysInMonth = getDaysInMonth(monthStart);
                        const dailyRate = (worker.salary || 0) / (daysInMonth);
                        
                        const presentDays = workerAttendance.filter(a => isSameMonth(parseISO(a.date), monthStart) && a.status === 'p').length;
                        const leaveDays = workerAttendance.filter(a => isSameMonth(parseISO(a.date), monthStart) && a.status === 'l').length;
                        const absentDays = workerAttendance.filter(a => isSameMonth(parseISO(a.date), monthStart) && a.status === 'a').length;

                        const allowedLeaves = worker.allowedLeaves || 0;
                        const paidLeaves = Math.min(leaveDays, allowedLeaves);
                        const unpaidLeaves = leaveDays > allowedLeaves ? leaveDays - allowedLeaves : 0;
                        
                        const paidDays = presentDays + paidLeaves;
                        const salaryEarned = paidDays * dailyRate;
                         
                         if (salaryEarned > 0) {
                            const descriptionComponent = (
                                <div className="flex flex-col">
                                    <span>Salary Earned for {format(monthStart, 'MMMM yyyy')}</span>
                                    <span className="text-xs">
                                        (<span className="text-green-600">P-{presentDays}</span>, <span className="text-yellow-600">L-{leaveDays}</span>, <span className="text-red-600">A-{absentDays}</span>)
                                    </span>
                                </div>
                            );

                             txs.push({
                                 date: endOfMonth(monthStart).toISOString(),
                                 description: descriptionComponent,
                                 credit: salaryEarned,
                                 debit: 0,
                             })
                         }
                     });
                }
            }
            
            const allTransactionsData = txs.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setAllTransactions(allTransactionsData);
        };
        fetchData();
    }, [worker]);

    const transactions = React.useMemo(() => {
        if (!dateRange?.from) return allTransactions;
        const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
        return allTransactions.filter(t => isWithinInterval(parseISO(t.date), interval));
    }, [allTransactions, dateRange]);
    
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
      { label: "Net Balance:", value: `PKR ${runningBalance.toFixed(2)}`, isBalance: true, className: runningBalance >= 0 ? "text-green-600" : "text-destructive" },
    ];
    
    const tableHeaders = [t('no.'), 'Date', 'Description', 'Debit', 'Credit', 'Balance'];

    return (
        <Tabs defaultValue="ledger">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ledger">{t('profileAndHistory')}</TabsTrigger>
                <TabsTrigger value="attendance">{t('attendanceCalendar')}</TabsTrigger>
            </TabsList>
            <TabsContent value="ledger">
                <Invoice
                    title="workerLedger"
                    businessProfile={businessProfile}
                    party={{
                        name: worker.name,
                        address: worker.address,
                        contact: worker.contact,
                        type: "Worker"
                    }}
                    reference={{
                        number: worker.cnic || worker.id,
                        date: worker.joiningDate.toString(),
                        type: 'Worker ID'
                    }}
                    table={{
                        headers: tableHeaders,
                        rows: finalTableRows,
                        footer: []
                    }}
                    paymentSummary={summaryDetails}
                    status={worker.status}
                    dateRangePicker={<DateRangePicker date={dateRange} setDate={setDateRange} />}
                    dateRange={dateRange}
                    rowRange={rowRange}
                    setRowRange={setRowRange}
                />
            </TabsContent>
            <TabsContent value="attendance">
                <WorkerAttendanceCalendar workerId={worker.id} />
            </TabsContent>
        </Tabs>
    )
}
