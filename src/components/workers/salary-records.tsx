
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { dbLoad, dbSave, dbClearAndSave } from "@/lib/db";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
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
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "../ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Separator } from "../ui/separator";
import { ImageIcon, X } from "lucide-react";
import Image from 'next/image';
import { WorkerPaymentDetails } from "./worker-payment-details";
import { ScrollArea } from "../ui/scroll-area";

const formSchema = z.object({
  workerId: z.string().min(1, "Please select a worker."),
  transactionType: z.enum(["salary", "advance", "daily_expense", "tip", "penalty", "adjustment"]),
  amount: z.number(),
  date: z.date(),
  accountId: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
}).refine(data => {
    if (data.transactionType === 'penalty' || data.transactionType === 'tip') {
        return true;
    }
    return !!data.accountId && data.accountId.length > 0;
}, {
    message: "Please select a payment account.",
    path: ["accountId"],
});

type SalaryFormValues = z.infer<typeof formSchema>;

type Worker = { 
    id: string; 
    name: string; 
    salary?: number;
    workType: 'salary' | 'work_based';
    balance: number; 
}
type SalaryTransaction = { id: string, date: string, workerName: string, workerId: string, type: string, amount: number, notes?: string, accountId?: string, attachments?: string[] }
type Account = { id: string; name: string; }

const generatePaymentId = async () => {
    const transactions = await dbLoad("salary-transactions");
    const lastIdNumber = transactions
        .map(t => t.id)
        .filter(id => id && id.startsWith("PAY-"))
        .map(id => parseInt(id.replace("PAY-", ""), 10))
        .filter(num => !isNaN(num))
        .sort((a, b) => b - a)[0] || 0;
    
    const newNumber = lastIdNumber + 1;
    return `PAY-${String(newNumber).padStart(4, '0')}`;
};

export function SalaryRecords() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<SalaryTransaction[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<SalaryTransaction | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<SalaryTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<SalaryTransaction | null>(null);
  const [deleteConfirmationCode, setDeleteConfirmationCode] = useState('');
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [filterWorkerId, setFilterWorkerId] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const fetchAllData = async () => {
    const storedWorkers = await dbLoad("workers");
    setWorkers(storedWorkers);
    const storedAccounts = await dbLoad("accounts");
    setAccounts(storedAccounts);
    const storedTransactions = await dbLoad("salary-transactions");
    setTransactions(storedTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }

  useEffect(() => {
    fetchAllData();
  }, []);

  const form = useForm<SalaryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transactionType: "salary",
      amount: 0,
      date: new Date(),
      notes: "",
      attachments: [],
    },
  });
  
  const transactionType = form.watch("transactionType");

  const filteredTransactions = useMemo(() => {
    let results = transactions;

    if (filterWorkerId !== 'all') {
        results = results.filter(t => t.workerId === filterWorkerId);
    }
    
    if (dateRange?.from) {
        const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
        results = results.filter(t => isWithinInterval(parseISO(t.date), interval));
    }

    return results;
  }, [transactions, filterWorkerId, dateRange]);


  const handleWorkerChange = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    if(worker) {
        setSelectedWorker(worker);
        form.setValue("workerId", workerId);
        if(worker.workType === 'salary'){
            form.setValue("transactionType", "salary");
            form.setValue("amount", worker.salary || 0);
        } else {
            form.setValue("transactionType", "advance");
            form.setValue("amount", 0);
        }
    } else {
        setSelectedWorker(null);
    }
  }

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
        const currentAttachments = form.getValues("attachments") || [];
        for (let i = 0; i < files.length; i++) {
            const reader = new FileReader();
            reader.onloadend = () => {
                form.setValue("attachments", [...currentAttachments, reader.result as string]);
            };
            reader.readAsDataURL(files[i]);
        }
    }
  };

  const removeAttachment = (index: number) => {
    const currentAttachments = form.getValues("attachments") || [];
    currentAttachments.splice(index, 1);
    form.setValue("attachments", currentAttachments);
  };

  const onSubmit = async (data: SalaryFormValues) => {
    try {
        const currentTransactions: SalaryTransaction[] = await dbLoad("salary-transactions");
        const worker = workers.find(w => w.id === data.workerId);
        if (!worker) throw new Error("Worker not found");

        const newTransaction = {
            id: await generatePaymentId(),
            date: data.date.toISOString(),
            workerId: worker.id,
            workerName: worker.name,
            type: data.transactionType,
            amount: data.amount,
            notes: data.notes,
            accountId: data.accountId,
            attachments: data.attachments || [],
        };
        currentTransactions.push(newTransaction);
        await dbSave("salary-transactions", currentTransactions);
        
        if (data.accountId && data.transactionType !== 'penalty' && data.transactionType !== 'tip') {
            const currentAccounts = await dbLoad("accounts");
            const accountIndex = currentAccounts.findIndex(a => a.id === data.accountId);
            if (accountIndex > -1) {
                currentAccounts[accountIndex].balance -= data.amount;
                await dbSave("accounts", currentAccounts);
            }
        }

        toast({
            title: "Transaction Recorded",
            description: `Transaction for ${worker.name} has been saved.`,
        });
        
        fetchAllData();
        form.reset({
            amount: worker?.workType === 'salary' ? (worker.salary || 0) : 0,
            workerId: data.workerId,
            date: new Date(),
            notes: '',
            accountId: '',
            attachments: []
        });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record transaction. Please try again.",
      });
    }
  };
  
  const handleEditSubmit = async (data: SalaryFormValues) => {
    if (!editingTransaction) return;
    try {
        const currentTransactions: SalaryTransaction[] = await dbLoad("salary-transactions");
        const txIndex = currentTransactions.findIndex(t => t.id === editingTransaction.id);
        if (txIndex > -1) {
            currentTransactions[txIndex] = { ...currentTransactions[txIndex], ...data, date: data.date.toISOString(), workerName: workers.find(w => w.id === data.workerId)?.name || 'N/A' };
        }
        await dbSave("salary-transactions", currentTransactions);
        toast({ title: "Transaction Updated" });
        setEditingTransaction(null);
        fetchAllData();
    } catch (error) {
        toast({ variant: "destructive", title: "Update Failed" });
    }
  }

  const openDeleteDialog = (transaction: SalaryTransaction) => {
    setTransactionToDelete(transaction);
    setDeleteConfirmationCode(String(Math.floor(1000 + Math.random() * 9000)));
    setDeleteConfirmationInput('');
  }

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return;

    const updatedTransactions = transactions.filter(t => t.id !== transactionToDelete.id);
    await dbClearAndSave("salary-transactions", updatedTransactions);
    setTransactions(updatedTransactions);
    toast({
        variant: "destructive",
        title: "Transaction Deleted"
    });
    setTransactionToDelete(null);
  }
  
  const getAccountName = (accountId?: string) => {
      if (!accountId) return 'N/A';
      return accounts.find(a => a.id === accountId)?.name || 'N/A';
  }

  const getBadgeVariant = (type: string): "secondary" | "outline" | "destructive" | "default" => {
    switch (type) {
        case 'salary':
        case 'tip':
            return 'secondary';
        case 'advance':
        case 'daily_expense':
            return 'outline';
        case 'penalty':
            return 'destructive';
        default:
            return 'default';
    }
  }

  const EditForm = ({ transaction, onFinish }: { transaction: SalaryTransaction, onFinish: (data: SalaryFormValues) => void }) => {
    const editForm = useForm<SalaryFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            ...transaction,
            date: new Date(transaction.date),
            transactionType: transaction.type as any,
            notes: transaction.notes || '',
            attachments: transaction.attachments || [],
        }
    });
    
    const editTransactionType = editForm.watch("transactionType");
    const attachments = editForm.watch("attachments") || [];

    const handleEditAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const currentAttachments = editForm.getValues("attachments") || [];
            for (let i = 0; i < files.length; i++) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    editForm.setValue("attachments", [...currentAttachments, reader.result as string]);
                };
                reader.readAsDataURL(files[i]);
            }
        }
    };

    const removeEditAttachment = (index: number) => {
        const currentAttachments = editForm.getValues("attachments") || [];
        currentAttachments.splice(index, 1);
        editForm.setValue("attachments", currentAttachments);
    };

    return (
         <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onFinish)} className="space-y-4 py-4">
                 <FormField
                    control={editForm.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>{t('date')}</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? ( format(field.value, "PPP") ) : ( <span>{t('pickADate')}</span> )}
                                    <Icons.calendar className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={editForm.control}
                    name="transactionType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('paymentType')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="salary">{t('salary')}</SelectItem>
                                <SelectItem value="advance">{t('advance')}</SelectItem>
                                <SelectItem value="daily_expense">{t('dailyExpense')}</SelectItem>
                                <SelectItem value="tip">{t('tip')}</SelectItem>
                                <SelectItem value="penalty">{t('penalty')}</SelectItem>
                                <SelectItem value="adjustment">Adjustment</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                {(editTransactionType !== 'penalty' && editTransactionType !== 'tip') && (
                    <FormField
                        control={editForm.control}
                        name="accountId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Payment Account</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select account to pay from" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {accounts.map(account => (
                                        <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                <FormField
                    control={editForm.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                    )}
                />
                <FormField
                    control={editForm.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                />
                 <FormItem>
                    <FormLabel>Attachments</FormLabel>
                    <div className="flex flex-wrap gap-2">
                        {attachments.map((src, index) => (
                            <div key={index} className="relative">
                                <Image src={src} alt={`Attachment ${index + 1}`} width={80} height={80} className="rounded-md object-cover"/>
                                <Button type="button" size="icon" variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full" onClick={() => removeEditAttachment(index)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <FormControl>
                        <Input id="edit-attachment-upload" type="file" multiple accept="image/*" onChange={handleEditAttachmentChange} />
                    </FormControl>
                </FormItem>
                <DialogFooter>
                    <Button type="submit">Save Changes</Button>
                </DialogFooter>
            </form>
        </Form>
    )
  }

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <Card>
            <CardHeader>
                <CardTitle>{t('salaryPayment')}</CardTitle>
                <CardDescription>{t('salaryPaymentDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="workerId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t('selectWorker')}</FormLabel>
                                <Select onValueChange={handleWorkerChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={t('chooseWorker')} /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {workers.map(worker => (
                                            <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />

                    {selectedWorker && <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="transactionType"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t('paymentType')}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="salary">{t('salary')}</SelectItem>
                                        <SelectItem value="advance">{t('advance')}</SelectItem>
                                        <SelectItem value="daily_expense">{t('dailyExpense')}</SelectItem>
                                        <SelectItem value="tip">{t('tip')}</SelectItem>
                                        <SelectItem value="penalty">{t('penalty')}</SelectItem>
                                        <SelectItem value="adjustment">Adjustment</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t('amount')}</FormLabel>
                                <FormControl>
                                <Input type="number" {...field} 
                                value={field.value || 0}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        {(transactionType !== 'penalty' && transactionType !== 'tip') &&
                            <FormField
                                control={form.control}
                                name="accountId"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Payment Account</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select account to pay from" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {accounts.map(account => (
                                                <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        }

                         <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>{t('date')}</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={"outline"}
                                        className={cn(
                                            "pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        >
                                        {field.value ? (
                                            format(field.value, "PPP")
                                        ) : (
                                            <span>{t('pickADate')}</span>
                                        )}
                                        <Icons.calendar className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                            />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t('notesOptional')}</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="e.g., Salary for month of June" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormItem>
                          <FormLabel>Proof (Optional)</FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {(form.watch("attachments") || []).map((src, index) => (
                                <div key={index} className="relative">
                                    <Image src={src} alt={`Attachment ${index + 1}`} width={60} height={60} className="rounded-md object-cover"/>
                                    <Button type="button" size="icon" variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full" onClick={() => removeAttachment(index)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                          </div>
                           <FormControl>
                                <Input id="attachment-upload" type="file" multiple accept="image/*" onChange={handleAttachmentChange} className="mt-2" />
                            </FormControl>
                        </FormItem>

                    </div>}
                    <CardFooter className="flex justify-end gap-2 p-0 pt-6">
                        <Button type="submit" disabled={!selectedWorker}>
                            <Icons.plus className="mr-2" /> {t('recordPayment')}
                        </Button>
                    </CardFooter>
                </form>
                </Form>
            </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>{t('salaryHistory')}</CardTitle>
                            <CardDescription>{t('salaryHistoryDescription')}</CardDescription>
                        </div>
                         <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                           <Select value={filterWorkerId} onValueChange={setFilterWorkerId}>
                             <SelectTrigger className="w-full sm:w-[180px]">
                               <SelectValue placeholder="Filter by worker" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="all">All Workers</SelectItem>
                               {workers.map(w => (
                                 <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                           <DateRangePicker date={dateRange} setDate={setDateRange} />
                         </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[600px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>{t('date')}</TableHead>
                                <TableHead>{t('workerName')}</TableHead>
                                <TableHead>{t('paymentType')}</TableHead>
                                <TableHead>{t('details')}</TableHead>
                                <TableHead className="text-right">{t('amount')}</TableHead>
                                <TableHead className="text-right">{t('actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTransactions.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell>{format(new Date(t.date), "PPP")}</TableCell>
                                    <TableCell className="font-medium">{t.workerName}</TableCell>
                                    <TableCell>
                                        <Badge variant={getBadgeVariant(t.type)}>
                                            {t.type.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {t.notes || 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right">PKR {t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => setViewingTransaction(t)}>
                                            <Icons.search className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setEditingTransaction(t)}>
                                            <Icons.settings className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(t)}>
                                            <Icons.trash className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                ))}
                                {filteredTransactions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24">{t('noTransactionsFound')}</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    </div>
    
     <Dialog open={!!viewingTransaction} onOpenChange={(open) => !open && setViewingTransaction(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {viewingTransaction && <WorkerPaymentDetails transaction={viewingTransaction} />}
        </DialogContent>
    </Dialog>

    <Dialog open={!!editingTransaction} onOpenChange={setEditingTransaction}>
        <DialogContent>
            <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
            {editingTransaction && <EditForm transaction={editingTransaction} onFinish={handleEditSubmit} />}
        </DialogContent>
    </Dialog>

     <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone and will permanently delete this salary transaction. To confirm, please type <code className="font-mono text-base bg-muted px-2 py-1 rounded-md">{deleteConfirmationCode}</code> in the box below.
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
