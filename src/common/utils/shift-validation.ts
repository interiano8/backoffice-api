export interface ValidationInput {
  docType: number;
  totalAmount: number;
  totalDiscount: number;
}

export interface ValidationResult {
  netSales: number;
  discounts: number;
  creditNotes: number;
  tickets: number;
  grossSales: number;
  calculatedTotal: number;
  otherProductsSales?: number;
}

export function computeValidationSummary(
  records: ValidationInput[],
  isOtherProductFn?: (row: any) => boolean,
): ValidationResult {
  let netSales = 0,
    discounts = 0,
    creditNotes = 0,
    tickets = 0,
    otherProductsSales = 0;

  records.forEach((row) => {
    const isOther = isOtherProductFn ? isOtherProductFn(row) : false;
    const amount = Number(row.totalAmount);
    const discount = Number(row.totalDiscount);

    if (row.docType === 1 || row.docType === 2) {
      if (isOther) otherProductsSales += amount;
      else netSales += amount;
      discounts += discount;
    } else if (row.docType === 3) creditNotes += Math.abs(amount);
    else if (row.docType === 7 || row.docType === 99) tickets += amount;
  });

  return {
    netSales,
    otherProductsSales,
    discounts,
    creditNotes,
    tickets,
    grossSales: netSales + discounts,
    calculatedTotal: netSales + discounts + creditNotes + tickets,
  };
}
