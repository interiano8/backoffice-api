export class TransferItemDto {
  productCode: string;
  productName?: string;
  quantity: number;
}

export class CreateTransferDto {
  fromStoreCode: string;
  toStoreCode: string;
  requestedBy: string;
  notes?: string;
  items: TransferItemDto[];
}

export class DispatchTransferDto {
  dispatchedBy?: string;
  items?: { productCode: string; quantity: number }[];
}

export class ReceiveTransferDto {
  receivedBy?: string;
  items?: { productCode: string; quantity: number }[];
}

export class CancelTransferDto {
  cancelledBy?: string;
  reason?: string;
}
