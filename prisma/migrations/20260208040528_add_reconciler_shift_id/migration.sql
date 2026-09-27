BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[BoSale] (
    [id] NVARCHAR(1000) NOT NULL,
    [source] NVARCHAR(1000) NOT NULL,
    [externalId] NVARCHAR(1000) NOT NULL,
    [saleIdFusion] NVARCHAR(1000),
    [timestamp] DATETIME2 NOT NULL,
    [shiftNo] NVARCHAR(1000),
    [shiftDate] DATETIME2,
    [amount] DECIMAL(18,4) NOT NULL,
    [volume] DECIMAL(18,4),
    [unitPrice] DECIMAL(18,4),
    [productName] NVARCHAR(1000),
    [unitOfMeasure] NVARCHAR(1000),
    [pumpId] NVARCHAR(1000),
    [hoseId] NVARCHAR(1000),
    [tankId] NVARCHAR(1000),
    [attendantName] NVARCHAR(1000),
    [customerId] NVARCHAR(1000),
    [customerName] NVARCHAR(1000),
    [billingType] NVARCHAR(1000),
    [paymentType] NVARCHAR(1000),
    [isReconciled] BIT NOT NULL CONSTRAINT [BoSale_isReconciled_df] DEFAULT 0,
    [storeCode] NVARCHAR(1000) NOT NULL CONSTRAINT [BoSale_storeCode_df] DEFAULT '002',
    [lineNo] INT NOT NULL CONSTRAINT [BoSale_lineNo_df] DEFAULT 0,
    [discount] DECIMAL(18,4),
    [reconcilerShiftId] NVARCHAR(1000),
    CONSTRAINT [BoSale_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BoSale_source_storeCode_externalId_lineNo_key] UNIQUE NONCLUSTERED ([source],[storeCode],[externalId],[lineNo])
);

-- CreateTable
CREATE TABLE [dbo].[BoShift] (
    [id] NVARCHAR(1000) NOT NULL,
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [BoShift_source_df] DEFAULT 'TPV',
    [storeCode] NVARCHAR(1000) NOT NULL CONSTRAINT [BoShift_storeCode_df] DEFAULT '002',
    [shiftDate] DATETIME2 NOT NULL,
    [shiftNo] NVARCHAR(1000) NOT NULL,
    [employeeName] NVARCHAR(1000) NOT NULL,
    [startTime] DATETIME2 NOT NULL,
    [endTime] DATETIME2,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [BoShift_status_df] DEFAULT 'OPEN',
    [totalSale] DECIMAL(18,4) NOT NULL CONSTRAINT [BoShift_totalSale_df] DEFAULT 0,
    [totalDiscount] DECIMAL(18,4) NOT NULL CONSTRAINT [BoShift_totalDiscount_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BoShift_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BoShift_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BoShift_source_storeCode_shiftDate_shiftNo_employeeName_key] UNIQUE NONCLUSTERED ([source],[storeCode],[shiftDate],[shiftNo],[employeeName])
);

-- CreateTable
CREATE TABLE [dbo].[BoStore] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(1000),
    [ip] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [BoStore_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BoStore_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BoStore_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BoStore_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[BoPaymentMethod] (
    [id] NVARCHAR(1000) NOT NULL,
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [BoPaymentMethod_source_df] DEFAULT 'TPV',
    [storeCode] NVARCHAR(1000) NOT NULL CONSTRAINT [BoPaymentMethod_storeCode_df] DEFAULT '002',
    [transactionId] NVARCHAR(1000) NOT NULL,
    [chargeLineNo] INT NOT NULL,
    [shiftDate] DATETIME2 NOT NULL,
    [shiftNo] NVARCHAR(1000) NOT NULL,
    [employeeName] NVARCHAR(1000) NOT NULL,
    [chargeMethodCode] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [amount] DECIMAL(18,4) NOT NULL,
    [paymentCardNo] NVARCHAR(1000),
    [additionalData] NVARCHAR(1000),
    [reconcilerShiftId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BoPaymentMethod_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BoPaymentMethod_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BoPaymentMethod_source_storeCode_transactionId_chargeLineNo_key] UNIQUE NONCLUSTERED ([source],[storeCode],[transactionId],[chargeLineNo])
);

-- CreateTable
CREATE TABLE [dbo].[BoReconciliation] (
    [id] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [shiftNo] NVARCHAR(1000),
    [shiftDate] DATETIME2,
    [attendantName] NVARCHAR(1000),
    [pumpId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL,
    [difference] DECIMAL(18,4),
    [signedBy] NVARCHAR(1000),
    [signatureData] TEXT,
    [signedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BoReconciliation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BoReconciliation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BoHose] (
    [id] NVARCHAR(1000) NOT NULL,
    [storeCode] NVARCHAR(1000) NOT NULL CONSTRAINT [BoHose_storeCode_df] DEFAULT '002',
    [pumpId] INT NOT NULL,
    [hoseId] INT NOT NULL,
    [gradeId] INT NOT NULL,
    [gradeName] NVARCHAR(1000) NOT NULL,
    [unitPrice] DECIMAL(18,4),
    [tankId] NVARCHAR(1000),
    [hosePhysicalId] INT,
    [posCode] NVARCHAR(1000),
    [genericCode] NVARCHAR(1000),
    [unitOfMeasure] NVARCHAR(1000),
    [active] BIT NOT NULL CONSTRAINT [BoHose_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BoHose_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BoHose_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BoHose_storeCode_pumpId_hoseId_key] UNIQUE NONCLUSTERED ([storeCode],[pumpId],[hoseId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSale_timestamp_idx] ON [dbo].[BoSale]([timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSale_attendantName_idx] ON [dbo].[BoSale]([attendantName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSale_shiftNo_idx] ON [dbo].[BoSale]([shiftNo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSale_saleIdFusion_idx] ON [dbo].[BoSale]([saleIdFusion]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSale_storeCode_idx] ON [dbo].[BoSale]([storeCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSale_reconcilerShiftId_idx] ON [dbo].[BoSale]([reconcilerShiftId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoShift_shiftDate_idx] ON [dbo].[BoShift]([shiftDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoShift_employeeName_idx] ON [dbo].[BoShift]([employeeName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoShift_storeCode_idx] ON [dbo].[BoShift]([storeCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoPaymentMethod_storeCode_idx] ON [dbo].[BoPaymentMethod]([storeCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoPaymentMethod_shiftDate_idx] ON [dbo].[BoPaymentMethod]([shiftDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoPaymentMethod_shiftNo_idx] ON [dbo].[BoPaymentMethod]([shiftNo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoPaymentMethod_employeeName_idx] ON [dbo].[BoPaymentMethod]([employeeName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoPaymentMethod_reconcilerShiftId_idx] ON [dbo].[BoPaymentMethod]([reconcilerShiftId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoHose_storeCode_idx] ON [dbo].[BoHose]([storeCode]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
