
"use client";

import { useEffect, useState, useMemo } from "react";
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
import { dbLoad, dbSave } from "@/lib/db";
import { DateRangePicker } from "../ui/date-range-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import { FormattedCurrency } from "../ui/formatted-currency";

type Supplier = {
    id: string;
    name: string;
    contact: string;
    balance: number;
    createdAt?: string;
}
type Account = {
    id: string;
    name: string;
    balance: number;
}

interface PendingPayablesTableProps {
  isShopProfile?: boolean;
}

export function PendingPayablesTable({ isShopProfile = false }: PendingPayablesTableProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [allPayableSuppliers, setAllPayableSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentAccountId, setPaymentAccountId] = useState('');

  const fetchSuppliersAndAccounts = async () => {
    const storedSuppliers = await dbLoad("suppliers");
    const suppliersWithPayables = storedSuppliers.filter((supplier: Supplier) => supplier.balance > 0);
    setAllPayableSuppliers(suppliersWithPayables);
    const storedAccounts = await dbLoad("accounts");
    setAccounts(storedAccounts);
  }

  useEffect(() => {
    fetchSuppliersAndAccounts();
  }, []);

  const payableSuppliers = useMemo(() => {
    let results = allPayableSuppliers;
    if (dateRange?.from) {
      const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
      results = results.filter(s => s.createdAt && isWithinInterval(parseISO(s.createdAt), interval));
    }
    return results;
  }, [allPayableSuppliers, dateRange]);


  const openPaymentDialog = (supplier: Supplier) => {
    setPayingSupplier(supplier);
    setAmountPaid(supplier.balance); // Pre-fill with full due amount
    setPaymentAccountId('');
  }
  
  const handleMakePayment = async () => {
    if (!payingSupplier || !paymentAccountId || amountPaid <= 0) {
        toast({
            variant: "destructive",
            title: "Invalid Input",
            description: "Please fill all fields correctly.",
        });
        return;
    }

    try {
        const allSuppliers = await dbLoad("suppliers");
        const allAccounts = await dbLoad("accounts");
        const purchaseHistory = await dbLoad("purchases");

        const supplierIndex = allSuppliers.findIndex(s => s.id === payingSupplier.id);
        const accountIndex = allAccounts.findIndex(a => a.id === paymentAccountId);

        if(supplierIndex === -1 || accountIndex === -1) throw new Error("Supplier or account not found.");
        
        if (allAccounts[accountIndex].balance < amountPaid) {
            toast({
                variant: "destructive",
                title: "Insufficient Balance",
                description: `Not enough funds in ${allAccounts[accountIndex].name}.`,
            });
            return;
        }

        allSuppliers[supplierIndex].balance -= amountPaid;
        allAccounts[accountIndex].balance -= amountPaid;

        const paymentRecord = {
            billNumber: `PAYBILL-${Date.now()}`,
            purchaseDate: new Date().toISOString(),
            supplierId: payingSupplier.id,
            items: [],
            subtotal: 0,
            totalDiscount: 0,
            totalAdjustment: 0,
            grandTotal: 0,
            amountPaid: amountPaid,
            paymentAccountId: paymentAccountId,
            notes: `Payment made for outstanding balance on ${format(new Date(), 'PPP')}`,
            remainingBalance: 0,
        };
        purchaseHistory.push(paymentRecord);

        await dbSave("suppliers", allSuppliers);
        await dbSave("accounts", allAccounts);
        await dbSave("purchases", purchaseHistory);

        toast({
            title: "Payment Made",
            description: `PKR ${amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid to ${payingSupplier.name}.`,
        });

        fetchSuppliersAndAccounts();
        setPayingSupplier(null);

    } catch (error: any) {
        console.log(error);
        toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to record payment.",
        });
    }
  }


  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
                <CardTitle>{t("pendingPayables")}</CardTitle>
                <CardDescription>{isShopProfile ? 'Shops with a pending balance.' : 'Suppliers with a pending balance to be paid.'}</CardDescription>
            </div>
            <DateRangePicker date={dateRange} setDate={setDateRange} />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isShopProfile ? 'Shop Name' : 'Supplier Name'}</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Balance Payable</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payableSuppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.contact}</TableCell>
                <TableCell className="text-right text-destructive font-semibold">
                    <FormattedCurrency amount={supplier.balance} />
                </TableCell>
                <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openPaymentDialog(supplier)}>
                        <Icons.paymentsMade className="mr-2 h-4 w-4" />
                        Make Payment
                    </Button>
                </TableCell>
              </TableRow>
            ))}
             {payableSuppliers.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">No pending payables found.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog open={!!payingSupplier} onOpenChange={(open) => !open && setPayingSupplier(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Make Payment to {payingSupplier?.name}</DialogTitle>
                <DialogDescription>Record a payment made for an outstanding bill.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="amount">Amount Paid</Label>
                    <Input id="amount" type="number" value={amountPaid} onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="account">Pay From Account</Label>
                    <Select onValueChange={setPaymentAccountId} value={paymentAccountId}>
                        <SelectTrigger id="account"><SelectValue placeholder="Select an account" /></SelectTrigger>
                        <SelectContent>
                            {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setPayingSupplier(null)}>Cancel</Button>
                <Button onClick={handleMakePayment}>Confirm Payment</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
