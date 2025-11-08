
"use client";

import * as React from "react";
import { toPng } from 'html-to-image';
import { Icons } from "@/components/icons";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Separator } from "./separator";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "./table";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { dbLoad } from "@/lib/db";
import { DateRange } from "react-day-picker";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Input } from "./input";
import { Label } from "./label";

type BusinessProfile = {
  businessName: string;
  address: string;
  phone: string;
  [key: string]: any;
};

type GlobalProfile = {
    brandName?: string;
    brandSlogan?: string;
    brandLogo?: string;
    whatsapp?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
    x?: string;
    [key: string]: any;
}

type Party = {
  name: string;
  address?: string;
  contact?: string;
  photo?: string;
  type: "Customer" | "Supplier" | "Worker" | "Product";
};

type Reference = {
  number: string;
  date: string;
  type: string;
};

type TableCellData = string | number | React.ReactNode | { value: string | number | React.ReactNode; className?: string };

type TableData = {
  headers: string[];
  rows: TableCellData[][];
  footer: string[];
};

type PaymentSummaryItem = {
    label: string;
    value: string;
    className?: string;
    isGrand?: boolean;
    isBalance?: boolean;
}

interface RowRange {
  start: number | null;
  end: number | null;
}

interface InvoiceProps {
  title: string;
  businessProfile: BusinessProfile | null;
  party: Party;
  reference: Reference;
  table: TableData;
  paymentSummary: PaymentSummaryItem[];
  status: string;
  dateRangePicker?: React.ReactNode;
  dateRange?: DateRange;
  rowRange?: RowRange;
  setRowRange?: (range: RowRange) => void;
  attachments?: string[] | null;
  notes?: string;
}

export function Invoice({
  title,
  businessProfile,
  party,
  reference,
  table,
  paymentSummary,
  status,
  dateRangePicker,
  dateRange,
  rowRange,
  setRowRange,
  attachments,
  notes,
}: InvoiceProps) {
  const { t } = useLanguage();
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [globalProfile, setGlobalProfile] = React.useState<GlobalProfile | null>(null);

  React.useEffect(() => {
    const fetchGlobalProfile = async () => {
        const profiles = await dbLoad('profiles');
        const globalProf = profiles.find(p => p.id === 'global-profile');
        setGlobalProfile(globalProf || null);
    }
    fetchGlobalProfile();
  }, []);
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleShare = React.useCallback(() => {
    const node = invoiceRef.current;
    const tableContainer = tableContainerRef.current;

    if (node === null || tableContainer === null) {
      return;
    }
    
    // Store original styles
    const originalNodeWidth = node.style.width;
    const originalTableMaxHeight = tableContainer.style.maxHeight;
    const originalTableOverflow = tableContainer.style.overflowY;

    // Apply temporary styles for image generation
    node.style.width = '1024px';
    tableContainer.style.maxHeight = 'none';
    tableContainer.style.overflowY = 'visible';

    toPng(node, { cacheBust: true, pixelRatio: 2, skipFonts: true })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `${reference.type.replace(/ /g, '-')}-${reference.number}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        // Restore original styles
        node.style.width = originalNodeWidth;
        tableContainer.style.maxHeight = originalTableMaxHeight;
        tableContainer.style.overflowY = originalTableOverflow;
      });
  }, [invoiceRef, reference]);

  const getInitials = (name: string) => {
    if (!name) return "";
    const words = name.split(' ');
    if (words.length > 1) {
      return words[0][0] + words[words.length - 1][0];
    }
    return name.substring(0, 2);
  }

  return (
    <div>
        <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
            <div className="flex items-center gap-2 flex-wrap">
                {dateRangePicker}
                {setRowRange && (
                    <div className="flex items-center gap-2">
                        <Label htmlFor="start-row" className="text-sm">Rows:</Label>
                        <Input 
                            id="start-row"
                            type="number" 
                            placeholder="Start" 
                            className="w-20 h-9"
                            value={rowRange?.start ?? ''}
                            onChange={(e) => setRowRange({ ...rowRange!, start: e.target.value ? parseInt(e.target.value) : null })}
                        />
                        <span>-</span>
                        <Input 
                            id="end-row"
                            type="number" 
                            placeholder="End" 
                            className="w-20 h-9"
                            value={rowRange?.end ?? ''}
                             onChange={(e) => setRowRange({ ...rowRange!, end: e.target.value ? parseInt(e.target.value) : null })}
                        />
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handlePrint}>
                    <Icons.print className="mr-2" /> {t('print')}
                </Button>
                <Button variant="outline" onClick={handleShare}>
                    <Icons.image className="mr-2" /> {t('shareAsImage')}
                </Button>
            </div>
        </div>
        <Card id="invoice-content" ref={invoiceRef} className="p-4 sm:p-6 print:shadow-none print:border-none">
          <CardContent className="p-0">
              <header className="mb-6">
                  <div className="flex justify-between items-start">
                      <div>
                           <div className="flex items-center gap-2 mb-2">
                              {globalProfile?.brandLogo ? (
                                  <img src={globalProfile.brandLogo} alt="Brand Logo" className="h-10 w-10 object-contain" />
                              ) : (
                                  <Icons.logo className="size-8 text-primary" />
                              )}
                              <div>
                                  <h1 className="text-2xl font-bold text-primary">{globalProfile?.brandName || 'MD Business Flow'}</h1>
                                  <p className="text-xs text-muted-foreground">{globalProfile?.brandSlogan || 'Your Modern Business Management Solution'}</p>
                              </div>
                          </div>
                           <div className="pl-10">
                              <h2 className="text-lg font-semibold">{businessProfile?.businessName}</h2>
                              <p className="text-sm text-muted-foreground">{businessProfile?.address}</p>
                              <p className="text-sm text-muted-foreground">{businessProfile?.phone}</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <h2 className="text-xl font-semibold uppercase tracking-wider">{t(title as keyof any)}</h2>
                          <p className={cn("text-lg font-bold mt-2", status === 'Paid' || status === 'Settled' ? 'text-green-600' : 'text-destructive')}>{t(status.toLowerCase() as keyof any)}</p>
                           <div className="grid grid-cols-2 gap-x-4 mt-2">
                                <div className="font-semibold text-muted-foreground">{reference.type}:</div>
                                <div>{reference.number}</div>

                                <div className="font-semibold text-muted-foreground mt-1">{t('date')}:</div>
                                <div className="mt-1">{format(new Date(reference.date), "PPP")}</div>

                                {dateRange?.from && (
                                    <>
                                        <div className="font-semibold text-muted-foreground mt-1 col-span-2 text-left">Period:</div>
                                        <div className="mt-1 text-xs col-span-2 text-left">
                                            {format(dateRange.from, "MMM d, yyyy")}
                                            {dateRange.to ? ` - ${format(dateRange.to, "MMM d, yyyy")}` : ''}
                                        </div>
                                    </>
                                )}
                           </div>
                      </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-start gap-4">
                           <Avatar className="h-14 w-14 border">
                                <AvatarImage src={party.photo} alt={party.name} className="object-cover" />
                                <AvatarFallback>{getInitials(party.name)}</AvatarFallback>
                            </Avatar>
                          <div>
                            <p className="font-semibold text-muted-foreground">{t(party.type as keyof any)} {t('details')}</p>
                            <p className="font-bold">{party.name}</p>
                            {party.address && <p>{party.address}</p>}
                            {party.contact && <p>{party.contact}</p>}
                          </div>
                      </div>
                  </div>
              </header>

              <main ref={tableContainerRef} className="max-h-[400px] overflow-y-auto print:max-h-none print:overflow-visible">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              {table.headers.map((header, i) => (
                              <TableHead key={i} className={cn(i > 2 && "text-right")}>{header}</TableHead>
                              ))}
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                           {table.rows.map((row, i) => (
                              <TableRow key={i}>
                              {row.map((cell, j) => {
                                  const cellValue = typeof cell === 'object' && cell !== null && 'value' in cell ? cell.value : cell;
                                  const cellClassName = typeof cell === 'object' && cell !== null && 'className' in cell ? cell.className : '';
                                  const formattedValue = typeof cellValue === 'number'
                                    ? cellValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                                    : cellValue;

                                  return (
                                      <TableCell key={j} className={cn(j > 2 && "text-right", cellClassName)}>
                                        {formattedValue}
                                      </TableCell>
                                  );
                              })}
                              </TableRow>
                          ))}
                          {table.rows.length === 0 && (
                              <TableRow><TableCell colSpan={table.headers.length} className="text-center h-24">{t('noTransactionsFound')}</TableCell></TableRow>
                          )}
                      </TableBody>
                  </Table>
              </main>
              
              <footer className="mt-6 print:mt-6">
                  <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 space-y-4">
                        {notes && (
                            <div>
                                <p className="font-semibold text-muted-foreground mb-1">{t('notesOptional')}</p>
                                <p className="text-xs border p-2 rounded-md bg-muted/20">{notes}</p>
                            </div>
                        )}
                        {attachments && attachments.length > 0 && (
                            <div>
                                <p className="font-semibold text-muted-foreground mb-2">{t('attachments')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {attachments.map((attachment, index) => (
                                        <div key={index} className="rounded-md overflow-hidden border">
                                            <Image src={attachment} alt={`Attachment ${index + 1}`} width={100} height={100} className="object-contain" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                      </div>
                      <div className={cn("w-full max-w-sm")}>
                           {paymentSummary.map((item, i) => (
                              <React.Fragment key={i}>
                              {(item.isGrand || item.isBalance) && <Separator className="my-2" />}
                              <div className={cn("flex justify-between", item.isGrand && "text-lg font-bold", item.isBalance && "text-xl font-bold")}>
                                  <span className={cn("font-semibold", item.className)}>{t(item.label.replace(':', '') as keyof any)}</span>
                                  <span className={cn("font-bold", item.className)}>{item.value}</span>
                              </div>
                              </React.Fragment>
                          ))}
                      </div>
                  </div>
                  <Separator className="my-4" />
                   <div className="flex justify-between items-end text-xs text-muted-foreground">
                        <div className="space-y-1">
                            {globalProfile?.whatsapp && <p className="flex items-center gap-2"><Icons.whatsapp className="h-3 w-3" /> WhatsApp: {globalProfile.whatsapp}</p>}
                            {globalProfile?.facebook && <p className="flex items-center gap-2"><Icons.facebook className="h-3 w-3" /> Facebook: {globalProfile.facebook}</p>}
                            {globalProfile?.instagram && <p className="flex items-center gap-2"><Icons.instagram className="h-3 w-3" /> Instagram: {globalProfile.instagram}</p>}
                            {globalProfile?.x && <p className="flex items-center gap-2"><Icons.x className="h-3 w-3" /> X: {globalProfile.x}</p>}
                            {globalProfile?.youtube && <p className="flex items-center gap-2"><Icons.youtube className="h-3 w-3" /> YouTube: {globalProfile.youtube}</p>}
                            {globalProfile?.tiktok && <p className="flex items-center gap-2"><Icons.tiktok className="h-3 w-3" /> TikTok: {globalProfile.tiktok}</p>}
                        </div>
                        <div className="text-right">
                           <p>{t('thankYouMessage')}</p>
                           <p>{t('computerGenerated')}</p>
                           <p className="mt-2 text-xs">Powered by {t('dukaanxp')}</p>
                        </div>
                   </div>
              </footer>
          </CardContent>
      </Card>

       <style jsx global>{`
          @media print {
              body * {
                  visibility: hidden;
              }
              #invoice-content, #invoice-content * {
                  visibility: visible;
              }
              #invoice-content {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
              }
          }
      `}</style>
    </div>
  );
}
