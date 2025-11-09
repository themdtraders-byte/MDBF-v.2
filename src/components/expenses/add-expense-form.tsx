
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
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
import { FormattedCurrency } from "../ui/formatted-currency";
import { Separator } from "../ui/separator";

const formSchema = z.object({
  categoryId: z.string().min(1, "Expense category is required."),
  itemId: z.string().optional(),
  date: z.date(),
  totalBill: z.number().min(0.01, "Total bill must be greater than 0."),
  amountPaid: z.number().min(0, "Amount paid cannot be negative."),
  paymentAccountId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  shopId: z.string().optional(),
}).refine(data => {
  // If an amount is paid, a payment account must be selected
  if (data.amountPaid > 0) {
    return !!data.paymentAccountId && data.paymentAccountId.length > 0;
  }
  return true;
}, {
  message: "Please select an account to pay from.",
  path: ["paymentAccountId"],
});


type ExpenseFormValues = z.infer<typeof formSchema>;
type Account = { id: string; name: string; balance: number; usageCount?: number };
type ExpenseCategory = { id: string; name: string; usageCount?: number; items?: {id: string; name: string}[] };
type Shop = { id: string; name: string; balance: number };

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
      try {
        const type = JSON.parse(activeAccount).type;
        const isHome = type === 'Home';
        setIsHomeProfile(isHome);
        return isHome ? 'home-expense-categories' : 'business-expense-categories';
      } catch (e) {
        setIsHomeProfile(false);
        return 'business-expense-categories';
      }
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
      const storedShops: Shop[] = await dbLoad("suppliers"); 
      setShops(storedShops);
    }
  }, [isHomeProfile]);


  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);
  
  useEffect(() => {
    const activeAccount = localStorage.getItem('dukaanxp-active-account');
    if (activeAccount) {
        try {
            const type = JSON.parse(activeAccount).type;
            if (type === 'Home') {
                setIsHomeProfile(true);
            }
        } catch(e) {}
    }
  }, []);

  useEffect(() => {
    if (isHomeProfile) {
      fetchShops();
    }
  }, [isHomeProfile, fetchShops]);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: isEditMode && expenseToEdit ? {
        ...expenseToEdit,
        totalBill: (expenseToEdit as any).amount, // Map old 'amount' to 'totalBill'
        date: new Date(expenseToEdit.date),
        notes: expenseToEdit.notes || '',
        reference: expenseToEdit.reference || '',
        attachments: expenseToEdit.attachments || [],
        shopId: expenseToEdit.shopId || '',
        itemId: expenseToEdit.itemId || '',
    } : {
      date: new Date(),
      totalBill: 0,
      amountPaid: 0,
      notes: "",
      reference: "",
      attachments: [],
      shopId: '',
      itemId: '',
    },
  });
  
  useEffect(() => {
    if (isEditMode && expenseToEdit?.attachments) {
        form.setValue("attachments", expenseToEdit.attachments);
    }
  }, [isEditMode, expenseToEdit, form]);

  const attachments = form.watch("attachments") || [];
  const selectedCategoryId = form.watch("categoryId");
  const totalBill = form.watch("totalBill") || 0;
  const amountPaid = form.watch("amountPaid") || 0;
  const remainingBalance = totalBill - amountPaid;

  const handleCreateCategory = async (categoryName: string) => {
    const dbKey = getCategoryDbKey();
    const existingCategories = await dbLoad(dbKey);
    const newCategory: ExpenseCategory = {
        id: `CAT-${Date.now()}`,
        name: categoryName,
        usageCount: 1,
        items: []
    };
    existingCategories.push(newCategory);
    await dbSave(dbKey, existingCategories);
    await fetchCategories();
    toast({ title: "Expense Category Created" });
    form.setValue('categoryId', newCategory.id);
  };
  
  const handleCreateItemForCategory = async (itemName: string) => {
    if (!selectedCategoryId) return;
    
    const dbKey = getCategoryDbKey();
    const existingCategories = await dbLoad(dbKey);
    const categoryIndex = existingCategories.findIndex(c => c.id === selectedCategoryId);
    
    if (categoryIndex > -1) {
        const category = existingCategories[categoryIndex];
        const newItem = { id: `ITEM-${Date.now()}`, name: itemName };
        
        if (!category.items) {
            category.items = [];
        }
        category.items.push(newItem);
        
        await dbSave(dbKey, existingCategories);
        await fetchCategories(); // Refetch to update the state
        form.setValue('itemId', newItem.id);
        toast({ title: "Item Added", description: `"${itemName}" added to category.`});
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


  const onSubmit = async (data: ExpenseFormValues) => {
    try {
      const existingExpenses = await dbLoad("expenses");
      
      const expenseData = {
          ...data,
          date: data.date.toISOString(),
          // The main 'amount' for an expense record is the total bill value
          amount: data.totalBill, 
      };

      if(isEditMode) {
        const expenseIndex = existingExpenses.findIndex(e => e.id === expenseToEdit.id);
        if (expenseIndex > -1) {
            existingExpenses[expenseIndex] = { ...existingExpenses[expenseIndex], ...expenseData };
        }
      } else {
        existingExpenses.push({ id: `EXP-${Date.now()}`, ...expenseData });
        
        if (data.amountPaid > 0 && data.paymentAccountId) {
            const currentAccounts: Account[] = await dbLoad("accounts");
            const accountIndex = currentAccounts.findIndex(a => a.id === data.paymentAccountId);
            if(accountIndex > -1){
                currentAccounts[accountIndex].balance -= data.amountPaid;
                currentAccounts[accountIndex].usageCount = (currentAccounts[accountIndex].usageCount || 0) + 1;
                await dbSave("accounts", currentAccounts);
                fetchAccounts();
            }
        }

        const dbKey = getCategoryDbKey();
        const currentCategories: ExpenseCategory[] = await dbLoad(dbKey);
        const categoryIndex = currentCategories.findIndex(c => c.id === data.categoryId);
        if (categoryIndex > -1) {
            currentCategories[categoryIndex].usageCount = (currentCategories[categoryIndex].usageCount || 0) + 1;
            await dbSave(dbKey, currentCategories);
        }

        if (isHomeProfile && data.shopId && data.shopId !== 'none') {
            const suppliers: Shop[] = await dbLoad("suppliers");
            const supplierIndex = suppliers.findIndex(s => s.id === data.shopId);
            if(supplierIndex > -1) {
                // The remaining balance is what we owe the shop
                suppliers[supplierIndex].balance += (data.totalBill - data.amountPaid);
                await dbSave("suppliers", suppliers);
            }
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
            totalBill: 0,
            amountPaid: 0,
            categoryId: "",
            paymentAccountId: "",
            reference: "",
            notes: "",
            attachments: [],
            shopId: '',
            itemId: '',
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
  const selectedCategory = expenseCategories.find(c => c.id === selectedCategoryId);
  const itemOptionsForCategory = (selectedCategory?.items || []).map(item => ({ value: item.id, label: item.name }));


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
                          onChange={(value) => {
                            form.setValue('categoryId', value);
                            form.setValue('itemId', ''); // Reset item when category changes
                          }}
                          onCreate={handleCreateCategory}
                          placeholder={t('selectCategory')}
                        />
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 {isHomeProfile && selectedCategoryId && (
                    <FormField
                        control={form.control}
                        name="itemId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Item (Optional)</FormLabel>
                            <CreatableSelect
                                options={itemOptionsForCategory}
                                value={field.value || ""}
                                onChange={(value) => form.setValue('itemId', value)}
                                onCreate={handleCreateItemForCategory}
                                placeholder="Select or create an item"
                            />
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                 {isHomeProfile ? (
                    <FormField
                        control={form.control}
                        name="totalBill"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Total Bill / Price</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="0.00" {...field}
                                value={field.value === 0 ? '' : field.value}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                ) : (
                    <FormField
                        control={form.control}
                        name="totalBill" // For business profile, this is just 'amount'
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
                )}
             </div>

              {isHomeProfile && (
                <div className="p-4 border rounded-lg space-y-4">
                  <h3 className="text-md font-medium">Payment Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="amountPaid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount Paid Now</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center justify-center text-lg font-semibold">
                      <p>Remaining: <FormattedCurrency amount={remainingBalance} className={cn(remainingBalance > 0 && "text-destructive")} /></p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="paymentAccountId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('paymentFrom')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
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
                 {isHomeProfile && (
                    <FormField
                        control={form.control}
                        name="shopId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Shop (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a shop" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
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
             </div>
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
                        totalBill: 0,
                        amountPaid: 0,
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
