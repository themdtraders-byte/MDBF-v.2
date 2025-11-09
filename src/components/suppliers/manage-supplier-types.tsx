
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
  DialogFooter,
  DialogTrigger
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


const typeSchema = z.object({
  name: z.string().min(2, "Type name is required."),
  description: z.string().optional(),
});

type TypeFormValues = z.infer<typeof typeSchema>;
type SupplierType = {
    id: string;
    name: string;
    description?: string;
}

interface ManageSupplierTypesProps {
  isShopProfile?: boolean;
}

export function ManageSupplierTypes({ isShopProfile = false }: ManageSupplierTypesProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [types, setTypes] = useState<SupplierType[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<SupplierType | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<SupplierType | null>(null);
  const [deleteConfirmationCode, setDeleteConfirmationCode] = useState('');
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

  const form = useForm<TypeFormValues>({
    resolver: zodResolver(typeSchema),
  });

  const DATA_KEY = "supplier-types";

  const fetchTypes = async () => {
    const storedTypes = await dbLoad(DATA_KEY);
    setTypes(storedTypes);
  }

  useEffect(() => {
    fetchTypes();
  }, []);

  const openDialog = (type: SupplierType | null = null) => {
    setEditingType(type);
    form.reset(type ? { name: type.name, description: type.description } : { name: '', description: '' });
    setIsDialogOpen(true);
  }

  const openDeleteDialog = (type: SupplierType) => {
    setTypeToDelete(type);
    setDeleteConfirmationCode(String(Math.floor(1000 + Math.random() * 9000)));
    setDeleteConfirmationInput('');
  }

  const handleDeleteConfirm = async () => {
    if (!typeToDelete) return;

    const trash = await dbLoad('trash');
    const deletedItem = {
        id: `trash-${typeToDelete.id}-${Date.now()}`,
        type: 'Supplier Type',
        deletedAt: new Date().toISOString(),
        data: { ...typeToDelete, originalKey: DATA_KEY }
    };
    trash.push(deletedItem);
    await dbSave('trash', trash);

    const updatedTypes = types.filter(t => t.id !== typeToDelete.id);
    await dbClearAndSave(DATA_KEY, updatedTypes);
    setTypes(updatedTypes);
    
    toast({ title: "Type Moved to Trash" });
    setTypeToDelete(null);
  }

  const onSubmit = async (data: TypeFormValues) => {
    const currentTypes = await dbLoad(DATA_KEY);
    if (editingType) {
        const index = currentTypes.findIndex((t: SupplierType) => t.id === editingType.id);
        if (index > -1) {
            currentTypes[index] = { ...editingType, ...data };
        }
    } else {
        const newType = {
            id: `STYPE-${Date.now()}`,
            name: data.name,
            description: data.description,
        };
        currentTypes.push(newType);
    }
    await dbSave(DATA_KEY, currentTypes);
    setTypes(currentTypes);
    toast({ title: editingType ? "Type Updated" : "Type Created" });
    setIsDialogOpen(false);
    setEditingType(null);
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>{isShopProfile ? 'Manage Shop Types' : t("manageTypes")}</CardTitle>
            <CardDescription>Create and manage your {isShopProfile ? 'shop' : 'supplier'} types.</CardDescription>
        </div>
        <Button onClick={() => openDialog()}>
            <Icons.plus className="mr-2" /> Add New Type
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="font-medium">{type.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{type.description || 'N/A'}</TableCell>
                <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(type)}>
                        <Icons.settings className="h-4 w-4" />
                    </Button>
                     <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(type)}>
                        <Icons.trash className="h-4 w-4" />
                    </Button>
                </TableCell>
              </TableRow>
            ))}
             {types.length === 0 && (
                <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">No {isShopProfile ? 'shop' : 'supplier'} types found.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit' : 'Add'} {isShopProfile ? 'Shop' : 'Supplier'} Type</DialogTitle>
            <DialogDescription>
              {editingType ? `Update the details for this ${isShopProfile ? 'shop' : 'supplier'} type.` : `Create a new category for your ${isShopProfile ? 'shops' : 'suppliers'}.`}
            </DialogDescription>
          </DialogHeader>
           <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
               <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Type Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Factory, Dealer" {...field} />
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
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                        <Input placeholder="A short description" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <DialogFooter>
                    <Button type="submit">{editingType ? 'Save Changes' : 'Create Type'}</Button>
                </DialogFooter>
            </form>
           </Form>
        </DialogContent>
      </Dialog>
       <AlertDialog open={!!typeToDelete} onOpenChange={(open) => !open && setTypeToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action will move the type '{typeToDelete?.name}' to the trash. To confirm, please type <code className="font-mono text-base bg-muted px-2 py-1 rounded-md">{deleteConfirmationCode}</code> in the box below.
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
