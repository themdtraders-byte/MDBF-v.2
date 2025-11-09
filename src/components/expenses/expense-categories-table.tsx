
"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLanguage } from "@/hooks/use-language";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { dbLoad, dbSave, dbClearAndSave } from "@/lib/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";


const itemSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Item name cannot be empty."),
});

const typeSchema = z.object({
  name: z.string().min(2, "Category name is required."),
  description: z.string().optional(),
  items: z.array(itemSchema).optional()
});

type TypeFormValues = z.infer<typeof typeSchema>;
type ExpenseCategory = {
    id: string;
    name: string;
    description?: string;
    items?: { id: string; name: string }[];
}

type Expense = {
    id: string;
    categoryId: string;
    amount: number;
}


export function ExpenseCategoriesTable() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null);
  const [deleteConfirmationCode, setDeleteConfirmationCode] = useState('');
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isHomeProfile, setIsHomeProfile] = useState(false);

  const form = useForm<TypeFormValues>({
    resolver: zodResolver(typeSchema),
  });

   const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  const getCategoryDbKey = () => {
    if (typeof window === 'undefined') return 'business-expense-categories';
    const activeAccount = localStorage.getItem('dukaanxp-active-account');
    if (activeAccount) {
      try {
        const type = JSON.parse(activeAccount).type;
        const isHome = type === 'Home';
        setIsHomeProfile(isHome);
        return isHome ? 'home-expense-categories' : 'business-expense-categories';
      } catch (e) {
        return 'business-expense-categories';
      }
    }
    return 'business-expense-categories';
  }

  const fetchData = async () => {
      const dbKey = getCategoryDbKey();
      const storedCategories = await dbLoad(dbKey);
      setCategories(storedCategories);
      const storedExpenses = await dbLoad("expenses");
      setExpenses(storedExpenses);
  }

  useEffect(() => {
    fetchData();
  }, []);

  const getCategoryTotal = (categoryId: string) => {
    return expenses
        .filter(e => e.categoryId === categoryId)
        .reduce((total, e) => total + e.amount, 0);
  }

  const openDialog = (category: ExpenseCategory | null = null) => {
    setEditingCategory(category);
    form.reset(category ? { 
        name: category.name, 
        description: category.description,
        items: category.items || [],
    } : { 
        name: '', 
        description: '',
        items: [],
    });
    setIsDialogOpen(true);
  }
  
  const openDeleteDialog = (category: ExpenseCategory) => {
    setCategoryToDelete(category);
    setDeleteConfirmationCode(String(Math.floor(1000 + Math.random() * 9000)));
    setDeleteConfirmationInput('');
  }

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    const dbKey = getCategoryDbKey();
    const updatedCategories = categories.filter(c => c.id !== categoryToDelete.id);
    await dbClearAndSave(dbKey, updatedCategories);
    setCategories(updatedCategories);
    toast({ variant: 'destructive', title: "Category Deleted" });
    setCategoryToDelete(null);
  }

  const onSubmit = async (data: TypeFormValues) => {
    const dbKey = getCategoryDbKey();
    const currentCategories = await dbLoad(dbKey);
    if (editingCategory) {
        const index = currentCategories.findIndex((t: ExpenseCategory) => t.id === editingCategory.id);
        if (index > -1) {
            currentCategories[index] = { ...editingCategory, ...data };
        }
    } else {
        const newCategory = {
            id: `CAT-${Date.now()}`,
            name: data.name,
            description: data.description,
            items: data.items || [],
        };
        currentCategories.push(newCategory);
    }
    await dbSave(dbKey, currentCategories);
    setCategories(currentCategories);
    toast({ title: editingCategory ? "Category Updated" : "Category Created" });
    setIsDialogOpen(false);
    setEditingCategory(null);
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>{t("expenseCategories")}</CardTitle>
            <CardDescription>{t('expenseCategoryDescription')}</CardDescription>
        </div>
        <Button onClick={() => openDialog()}>
            <Icons.plus className="mr-2" /> {t('addNewCategory')}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category Name</TableHead>
              <TableHead>Description</TableHead>
              {isHomeProfile && <TableHead>Items</TableHead>}
              <TableHead className="text-right">{t('totalExpenses')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium flex items-center gap-2">
                    {category.name}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{category.description}</TableCell>
                {isHomeProfile && (
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(category.items || []).map(item => <Badge key={item.id} variant="outline">{item.name}</Badge>)}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-right">PKR {getCategoryTotal(category.id).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(category)}>
                        <Icons.settings className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(category)}>
                        <Icons.trash className="h-4 w-4" />
                    </Button>
                </TableCell>
              </TableRow>
            ))}
             {categories.length === 0 && (
                <TableRow>
                    <TableCell colSpan={isHomeProfile ? 5 : 4} className="text-center h-24">{t('noCategoriesFound')}</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit' : 'Add'} Expense Category</DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Update the details for this expense category.' : 'Create a new category for your expenses.'}
            </DialogDescription>
          </DialogHeader>
           <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
               <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>{t('categoryName')}</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Rent, Utilities" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>{t('descriptionOptional')}</FormLabel>
                    <FormControl>
                        <Input placeholder="A short description" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                {isHomeProfile && (
                    <div className="space-y-4 rounded-lg border p-4">
                        <h4 className="font-medium">Category Items</h4>
                         {fields.map((field, index) => (
                           <div key={field.id} className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.name`}
                                    render={({ field }) => (
                                        <Input {...field} placeholder={`Item ${index + 1} name`} />
                                    )}
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <X className="h-4 w-4" />
                                </Button>
                           </div>
                         ))}
                         <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `item-${Date.now()}`, name: '' })}>
                           <Icons.plus className="mr-2 h-4 w-4" />
                           Add Item
                         </Button>
                    </div>
                )}
                <DialogFooter>
                    <Button type="submit">{editingCategory ? t('saveChanges') : t('createCategory')}</Button>
                </DialogFooter>
            </form>
           </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone and will permanently delete the category '{categoryToDelete?.name}'. To confirm, please type <code className="font-mono text-base bg-muted px-2 py-1 rounded-md">{deleteConfirmationCode}</code> in the box below.
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
