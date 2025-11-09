
"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/hooks/use-language";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Badge } from "@/components/ui/badge";
import { dbLoad, dbSave, dbClearAndSave } from "@/lib/db";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DateRangePicker } from "../ui/date-range-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AddSupplierForm } from "./add-supplier-form";
import { SupplierDetails } from "./supplier-details";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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
import { DateRange } from "react-day-picker";
import { isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { useSearch } from "@/hooks/use-search";


type Supplier = {
    id: string;
    name: string;
    company?: string;
    typeId?: string;
    contact: string;
    whatsapp?: string;
    address?: string;
    cnic?: string;
    balance: number;
    paymentTerms?: string;
    notes?: string;
    status: string;
    city?: string;
    isQuickAdd?: boolean;
    createdAt?: string | Date;
}

type SupplierType = {
    id: string;
    name: string;
}

interface SupplierListTableProps {
  isShopProfile?: boolean;
}

export function SupplierListTable({ isShopProfile = false }: SupplierListTableProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { searchTerm } = useSearch();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierTypes, setSupplierTypes] = useState<SupplierType[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [deleteConfirmationCode, setDeleteConfirmationCode] = useState('');
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

  const fetchSuppliers = async () => {
    const storedSuppliers = await dbLoad("suppliers");
    setSuppliers(storedSuppliers);
    const storedTypes = await dbLoad("supplier-types");
    setSupplierTypes(storedTypes);

     const supplierIdToEdit = searchParams.get('edit');
    if (supplierIdToEdit) {
        const supplier = storedSuppliers.find(s => s.id === supplierIdToEdit);
        if (supplier) {
            handleEdit(supplier);
            router.replace('/suppliers', { scroll: false });
        }
    }
  }

  useEffect(() => {
    fetchSuppliers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredSuppliers = useMemo(() => {
    let result = suppliers.filter(supplier => 
        (supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (supplier.city && supplier.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        String(supplier.balance).includes(searchTerm)) &&
        (typeFilter === 'all' || supplier.typeId === typeFilter)
    );
    
    if (dateRange?.from && result.length > 0 && result[0].createdAt) {
      const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
      result = result.filter(s => {
        if (!s.createdAt) return false;
        const dateString = typeof s.createdAt === 'string' ? s.createdAt : s.createdAt!.toISOString();
        return isWithinInterval(parseISO(dateString), interval)
      });
    }

    return result;
  }, [searchTerm, typeFilter, dateRange, suppliers]);


  const getTypeName = (typeId?: string) => {
    if (!typeId) return 'N/A';
    return supplierTypes.find(t => t.id === typeId)?.name || 'Unknown';
  }
  
  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
  };

  const handleDeleteConfirm = async () => {
    if (!supplierToDelete) return;
    
    const trash = await dbLoad('trash');
    const deletedItem = {
      id: `trash-${supplierToDelete.id}-${Date.now()}`,
      type: 'Supplier',
      deletedAt: new Date().toISOString(),
      data: { ...supplierToDelete, originalKey: 'suppliers' },
    };
    trash.push(deletedItem);
    await dbSave('trash', trash);

    const updatedSuppliers = suppliers.filter((s) => s.id !== supplierToDelete.id);
    await dbClearAndSave('suppliers', updatedSuppliers);
    setSuppliers(updatedSuppliers);

    toast({
      title: `${isShopProfile ? 'Shop' : 'Supplier'} Moved to Trash`,
      description: `${supplierToDelete.name} has been moved to the trash.`,
    });
    setSupplierToDelete(null);
  };

  const openDeleteDialog = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteConfirmationCode(String(Math.floor(1000 + Math.random() * 9000)));
    setDeleteConfirmationInput('');
  }

  const handleEditFinish = () => {
    setEditingSupplier(null);
    fetchSuppliers();
  }


  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>{isShopProfile ? 'Shop List' : t("supplierList")}</CardTitle>
        <CardDescription>{isShopProfile ? 'View and manage all your shops.' : t('supplierListDescription')}</CardDescription>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-2 pt-4">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start">
                <DateRangePicker date={dateRange} setDate={setDateRange} />
                <Select onValueChange={setTypeFilter} defaultValue="all">
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder={isShopProfile ? 'Filter by type' : t('filterByType')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{isShopProfile ? 'All Types' : t('allTypes')}</SelectItem>
                        {supplierTypes.map(type => (
                            <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" className="w-full sm:w-auto">
                    <Icons.export className="mr-2 h-4 w-4" />
                    {t("export")}
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isShopProfile ? 'Shop Name' : t('supplierName')}</TableHead>
              <TableHead>{isShopProfile ? 'Type' : t('type')}</TableHead>
              <TableHead>{t('contact')}</TableHead>
              <TableHead className="text-right">{t('balanceDue')}</TableHead>
              <TableHead className="text-center">{t('status')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{getTypeName(supplier.typeId)}</TableCell>
                <TableCell>{supplier.contact}</TableCell>
                <TableCell className={cn("text-right font-semibold", supplier.balance > 0 ? 'text-destructive' : supplier.balance < 0 ? 'text-green-600' : '')}>
                    PKR {Math.abs(supplier.balance).toFixed(2)} {supplier.balance > 0 ? '(Payable)' : supplier.balance < 0 ? '(Adv)' : ''}
                </TableCell>
                <TableCell className="text-center">
                   <Badge variant={supplier.status === 'Active' ? 'secondary' : 'outline'}>{supplier.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setViewingSupplier(supplier)}>
                        <Icons.search className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(supplier)}>
                        <Icons.settings className="h-4 w-4" />
                    </Button>
                     <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(supplier)}>
                        <Icons.trash className="h-4 w-4" />
                    </Button>
                </TableCell>
              </TableRow>
            ))}
             {filteredSuppliers.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">No {isShopProfile ? 'shops' : 'suppliers'} found.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog open={!!editingSupplier} onOpenChange={(open) => !open && setEditingSupplier(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Edit {isShopProfile ? 'Shop' : 'Supplier'}</DialogTitle>
                <DialogDescription>
                    Update the details for this {isShopProfile ? 'shop' : 'supplier'}.
                </DialogDescription>
            </DialogHeader>
            {editingSupplier && <AddSupplierForm supplierToEdit={editingSupplier as any} onFinish={handleEditFinish} isShopProfile={isShopProfile} />}
        </DialogContent>
    </Dialog>

    <Dialog open={!!viewingSupplier} onOpenChange={(open) => !open && setViewingSupplier(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>{isShopProfile ? 'Shop' : 'Supplier'} Details</DialogTitle>
            </DialogHeader>
            {viewingSupplier && <SupplierDetails supplier={viewingSupplier} isShopProfile={isShopProfile} />}
        </DialogContent>
    </Dialog>

     <AlertDialog open={!!supplierToDelete} onOpenChange={(open) => !open && setSupplierToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action will move the {isShopProfile ? 'shop' : 'supplier'} '{supplierToDelete?.name}' to the trash. You can restore them from the trash later. To confirm, please type <code className="font-mono text-base bg-muted px-2 py-1 rounded-md">{deleteConfirmationCode}</code> in the box below.
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
