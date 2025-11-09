
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import React, { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { dbLoad, dbSave } from "@/lib/db";
import { CreatableSelect } from "../ui/creatable-select";
import { X, ImageIcon } from "lucide-react";
import Image from "next/image";

const formSchema = z.object({
  categoryId: z.string().min(1, "Expense category is required."),
  date: z.date(),
  amount: z.number().min(0.01, "Amount must be greater than 0."),
  paymentAccountId: z.string().min(1, "Payment account is required."),
  reference: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  shopId: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof formSchema>;
type Account = { id: string; name: string; balance: number; usageCount?: number };
type ExpenseCategory = { id: string; name: string; usageCount?: number };
type Shop = { id: string; name: string };

interface AddExpenseFormProps {
    expenseToEdit?: ExpenseFormValues & { id: string, date: string | Date };
    onFinish?: () => void;
}

export function AddExpenseForm({ expenseToEdit, onFinish }: AddExpenseFormProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [isHomeProfile, setIsHomeProfile] = useState(false);
  const isEditMode = !!expenseToEdit;

  const getCategoryDbKey = React.useCallback(() => {
    if (typeof window === 'undefined') return 'business-expense-categories';
    const activeAccount = localStorage.getItem('dukaanxp-active-account');
    if (activeAccount) {
      const type = JSON.parse(activeAccount).type;
      setIsHomeProfile(type === 'Home');
      return type === 'Home' ? 'home-expense-categories' : 'business-expense-categories';
    }
    setIsHomeProfile(false);
    return 'business-expense-categories';
  }, []);

  const fetchCategories = React.useCallback(async () => {
    const dbKey = getCategoryDbKey();
    const storedCategories: ExpenseCategory[] = await dbLoad(dbKey);
    storedCategories.sort((a,b) => (b.usageCount || 0) - (a.usageCount || 0) || a.name.localeCompare(b.name));
    setExpenseCategories(storedCategories);
  }, [getCategoryDbKey]);

  const fetchAccounts = React.useCallback(async () => {
    const storedAccounts: Account[] = await dbLoad("accounts");
    storedAccounts.sort((a,b) => (b.usageCount || 0) - (a.usageCount || 0) || a.name.localeCompare(b.name));
    setAccounts(storedAccounts);
  }, []);
  
  const fetchShops = React.useCallback(async () => {
    if (isHomeProfile) {
      const storedShops: Shop[] = await dbLoad("shops");
      setShops(storedShops);
    }
  }, [isHomeProfile]);


  useEffect(() => {
    fetchAccounts();
    fetchCategories();
    fetchShops();
  }, [fetchAccounts, fetchCategories, fetchShops]);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: isEditMode && expenseToEdit ? {
        ...expenseToEdit,
        date: new Date(expenseToEdit.date),
        notes: expenseToEdit.notes || '',
        reference: expenseToEdit.reference || '',
        attachments: expenseToEdit.attachments || [],
        shopId: expenseToEdit.shopId || '',
    } : {
      date: new Date(),
      amount: 0,
      notes: "",
      reference: "",
      attachments: [],
      shopId: '',
    },
  });
  
  useEffect(() => {
    if (isEditMode && expenseToEdit?.attachments) {
        form.setValue("attachments", expenseToEdit.attachments);
    }
  }, [isEditMode, expenseToEdit, form]);

  const attachments = form.watch("attachments") || [];


  const handleCreateCategory = async (categoryName: string) => {
    const dbKey = getCategoryDbKey();
    const existingCategories = await dbLoad(dbKey);
    const newCategory: ExpenseCategory = {
        id: `CAT-${Date.now()}`,
        name: categoryName,
        usageCount: 1,
    };
    existingCategories.push(newCategory);
    await dbSave(dbKey, existingCategories);
    await fetchCategories();
    toast({ title: "Expense Category Created" });
    form.setValue('categoryId', newCategory.id);
  };

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


  const onSubmit = async (data: ExpenseFormValues) => {
    try {
      const existingExpenses = await dbLoad("expenses");
      
      const expenseData = {
          ...data,
          date: data.date.toISOString(),
      };

      if(isEditMode) {
        const expenseIndex = existingExpenses.findIndex(e => e.id === expenseToEdit.id);
        if (expenseIndex > -1) {
            existingExpenses[expenseIndex] = { ...existingExpenses[expenseIndex], ...expenseData };
        }
      } else {
        existingExpenses.push({ id: `EXP-${Date.now()}`, ...expenseData });
        
        const currentAccounts: Account[] = await dbLoad("accounts");
        const accountIndex = currentAccounts.findIndex(a => a.id === data.paymentAccountId);
        if(accountIndex > -1){
            currentAccounts[accountIndex].balance -= data.amount;
            currentAccounts[accountIndex].usageCount = (currentAccounts[accountIndex].usageCount || 0) + 1;
            await dbSave("accounts", currentAccounts);
            fetchAccounts();
        }

        const dbKey = getCategoryDbKey();
        const currentCategories: ExpenseCategory[] = await dbLoad(dbKey);
        const categoryIndex = currentCategories.findIndex(c => c.id === data.categoryId);
        if (categoryIndex > -1) {
            currentCategories[categoryIndex].usageCount = (currentCategories[categoryIndex].usageCount || 0) + 1;
            await dbSave(dbKey, currentCategories);
        }
      }

      await dbSave("expenses", existingExpenses);

      toast({
        title: isEditMode ? t('expenseUpdated') : t('expenseRecorded'),
        description: isEditMode ? t('expenseUpdateSuccess') : t('expenseSavedSuccess'),
      });
      
      if(onFinish) {
          onFinish();
      } else {
        form.reset({
            date: new Date(),
            amount: 0,
            categoryId: "",
            paymentAccountId: "",
            reference: "",
            notes: "",
            attachments: [],
            shopId: '',
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('error'),
        description: isEditMode ? t('failedToUpdateExpense') : t('failedToSaveExpense'),
      });
    }
  };
  
  const categoryOptions = expenseCategories.map(cat => ({ value: cat.id, label: cat.name }));
  const shopOptions = shops.map(shop => ({ value: shop.id, label: shop.name }));

  return (
    <Card className={cn(isEditMode && "border-0 shadow-none")}>
      <CardHeader className={cn(isEditMode && "p-0")}>
        <CardTitle>{isEditMode ? t('editExpense') : t('addExpense')}</CardTitle>
      </CardHeader>
      <CardContent className={cn(isEditMode && "p-0 mt-6")}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('expenseCategory')}</FormLabel>
                        <CreatableSelect
                          options={categoryOptions}
                          value={field.value}
                          onChange={(value) => form.setValue('categoryId', value)}
                          onCreate={handleCreateCategory}
                          placeholder={t('selectCategory')}
                        />
                        <FormMessage />
                        </FormItem>
                    )}
                />
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
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('amount')}</FormLabel>
                        <FormControl>
                           <div className="relative">
                               <Icons.dollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                               <Input type="number" placeholder="0.00" {...field}
                                value={field.value === 0 ? '' : field.value}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="pl-10" />
                           </div>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="paymentAccountId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('paymentFrom')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder={t('selectPaymentAccount')} />
                            </SelectTrigger>
                            </FormControl>
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
             </div>
             {isHomeProfile && (
                <FormField
                    control={form.control}
                    name="shopId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Shop (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a shop" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="">None</SelectItem>
                                    {shopOptions.map(shop => (
                                        <SelectItem key={shop.value} value={shop.value}>{shop.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
             )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="reference"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('referenceOptional')}</FormLabel>
                        <FormControl>
                            <Input placeholder={t('referencePlaceholder')} {...field} value={field.value || ''} />
                        </FormControl>
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
                            <Textarea placeholder={t('expenseNotesPlaceholder')} {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
              </div>
              <FormItem>
                <FormLabel>{t('attachmentOptional')}</FormLabel>
                <div className="flex flex-wrap gap-2">
                    {attachments.map((src, index) => (
                        <div key={index} className="relative">
                            <Image src={src} alt={`Attachment ${index + 1}`} width={80} height={80} className="rounded-md object-cover"/>
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
             <CardFooter className="flex justify-end gap-2 p-0 pt-6">
                <Button type="submit">
                    <Icons.plus className="mr-2" /> {isEditMode ? t('saveChanges') : t('saveExpense')}
                </Button>
                {!isEditMode && 
                    <Button variant="outline" type="button" onClick={() => form.reset({
                        date: new Date(),
                        amount: 0,
                        categoryId: "",
                        paymentAccountId: "",
                    })}>
                        <Icons.plus className="mr-2" /> {t('newExpense')}
                    </Button>
                }
             </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
