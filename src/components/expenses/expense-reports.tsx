
"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useLanguage } from "@/hooks/use-language";
import { dbLoad, dbClearAndSave } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "../ui/button";
import { Icons } from "../icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { AddExpenseForm } from "../expenses/add-expense-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "../ui/separator";
import { DateRange } from "react-day-picker";
import { ExpenseDetails } from "../expenses/expense-details";


type Expense = {
    id: string;
    categoryId: string;
    itemId?: string;
    amount: number;
    date: string;
    notes?: string;
    reference?: string;
    attachments?: string[];
    paymentAccountId?: string;
}
type ExpenseCategory = { id: string; name: string; items?: {id: string; name: string}[] }
type Account = { id: string; name: string; }

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function ExpenseReports() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleteConfirmationCode, setDeleteConfirmationCode] = useState('');
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const fetchData = async () => {
    const storedExpenses = await dbLoad("expenses");
    setAllExpenses(storedExpenses);
    
    const activeAccount = JSON.parse(localStorage.getItem('dukaanxp-active-account') || '{}');
    const dbKey = activeAccount.type === 'Home' ? 'home-expense-categories' : 'business-expense-categories';
    setCategories(await dbLoad(dbKey));
    setAccounts(await dbLoad("accounts"));
  }

  useEffect(() => {
    fetchData();
  }, []);

  const expenses = useMemo(() => {
    if (!dateRange?.from) return allExpenses;
    const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
    return allExpenses.filter(e => {
        const dateValue = e.date;
        if (!dateValue) return false;
        const dateString = typeof dateValue === 'string' ? dateValue : dateValue.toISOString();
        try {
            return isWithinInterval(parseISO(dateString), interval);
        } catch {
            return false;
        }
    });
  }, [allExpenses, dateRange]);

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || t('uncategorized');
  }
  
  const getItemName = (categoryId: string, itemId?: string) => {
    if (!itemId) return 'N/A';
    const category = categories.find(c => c.id === categoryId);
    return category?.items?.find(i => i.id === itemId)?.name || 'N/A';
  }

  const getAccountName = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.name || 'N/A';
  }
  
  const categoryTotals = categories.map((cat, index) => ({
    name: cat.name,
    value: expenses.filter(e => e.categoryId === cat.id).reduce((sum, e) => sum + e.amount, 0),
    fill: COLORS[index % COLORS.length]
  })).filter(d => d.value > 0);
  
  const handleEditFinish = () => {
    setEditingExpense(null);
    fetchData();
  }

  const openDeleteDialog = (expense: Expense) => {
    setExpenseToDelete(expense);
    setDeleteConfirmationCode(String(Math.floor(1000 + Math.random() * 9000)));
    setDeleteConfirmationInput('');
  }

  const handleDeleteConfirm = async () => {
    if (!expenseToDelete) return;
    const updatedExpenses = allExpenses.filter(e => e.id !== expenseToDelete.id);
    await dbClearAndSave("expenses", updatedExpenses);
    setAllExpenses(updatedExpenses);
    toast({ variant: "destructive", title: "Expense Deleted" });
    setExpenseToDelete(null);
  }


  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>{t("expenseReports")}</CardTitle>
        <CardDescription>{t('salesReportDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Expense by Category</CardTitle>
            </CardHeader>
            <CardContent>
                <div style={{ width: '100%', height: 300 }}>
                    <ChartContainer config={{}} className="mx-auto aspect-square h-full">
                        <PieChart>
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Pie data={categoryTotals} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                             {categoryTotals.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        </PieChart>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                 <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{t('allExpensesTitle')}</CardTitle>
                        <CardDescription>{t('allExpensesDescription')}</CardDescription>
                    </div>
                    <DateRangePicker date={dateRange} setDate={setDateRange} />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('date')}</TableHead>
                            <TableHead>{t('category')}</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead>{t('notesOptional')}</TableHead>
                            <TableHead className="text-right">{t('amount')}</TableHead>
                            <TableHead className="text-right">{t('actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {expenses.map((expense) => (
                            <TableRow key={expense.id}>
                                <TableCell>{format(new Date(expense.date), "PPP")}</TableCell>
                                <TableCell><Badge variant="outline">{getCategoryName(expense.categoryId)}</Badge></TableCell>
                                <TableCell>{getItemName(expense.categoryId, expense.itemId)}</TableCell>
                                <TableCell>{expense.notes || 'N/A'}</TableCell>
                                <TableCell className="text-right font-semibold text-destructive">PKR {expense.amount.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => setViewingExpense(expense)}>
                                        <Icons.search className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setEditingExpense(expense)}>
                                        <Icons.settings className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(expense)}>
                                        <Icons.trash className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {expenses.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">
                                    No expenses recorded yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </CardContent>
    </Card>
    
    <Dialog open={!!viewingExpense} onOpenChange={(open) => !open && setViewingExpense(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
           <DialogHeader>
             <DialogTitle>Expense Details</DialogTitle>
           </DialogHeader>
           {viewingExpense && <ExpenseDetails expense={viewingExpense} />}
        </DialogContent>
    </Dialog>

    <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('editExpense')}</DialogTitle>
                <DialogDescription>{t('expenseUpdateSuccess')}</DialogDescription>
            </DialogHeader>
            <AddExpenseForm expenseToEdit={editingExpense as any} onFinish={handleEditFinish} />
        </DialogContent>
    </Dialog>
    
     <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone and will permanently delete this expense record. To confirm, please type <code className="font-mono text-base bg-muted px-2 py-1 rounded-md">{deleteConfirmationCode}</code> in the box below.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="delete-confirm">Confirmation Code</Label>
                <Input
                    id="delete-confirm"
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder="Enter the code to confirm"
                    autoFocus
                />
            </div>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteConfirmationInput !== deleteConfirmationCode} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
