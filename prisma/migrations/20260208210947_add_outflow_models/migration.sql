BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[BoShift] ADD [creditNoteCount] INT NOT NULL CONSTRAINT [BoShift_creditNoteCount_df] DEFAULT 0,
[invoiceCashCount] INT NOT NULL CONSTRAINT [BoShift_invoiceCashCount_df] DEFAULT 0,
[invoiceCreditCount] INT NOT NULL CONSTRAINT [BoShift_invoiceCreditCount_df] DEFAULT 0,
[outflowCount] INT NOT NULL CONSTRAINT [BoShift_outflowCount_df] DEFAULT 0;

-- CreateTable
CREATE TABLE [dbo].[BoOutflow] (
    [id] NVARCHAR(1000) NOT NULL,
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [BoOutflow_source_df] DEFAULT 'TPV',
    [storeCode] NVARCHAR(1000) NOT NULL,
    [docNo] NVARCHAR(1000) NOT NULL,
    [shiftDate] DATETIME2 NOT NULL,
    [shiftNo] NVARCHAR(1000) NOT NULL,
    [employeeName] NVARCHAR(1000) NOT NULL,
    [customerNo] NVARCHAR(1000),
    [rtn] NVARCHAR(1000),
    [km] NVARCHAR(1000),
    [orden] NVARCHAR(1000),
    [placa] NVARCHAR(1000),
    [chofer] NVARCHAR(1000),
    [discount] DECIMAL(18,4) NOT NULL CONSTRAINT [BoOutflow_discount_df] DEFAULT 0,
    [total] DECIMAL(18,4) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BoOutflow_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BoOutflow_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BoOutflow_source_storeCode_docNo_key] UNIQUE NONCLUSTERED ([source],[storeCode],[docNo])
);

-- CreateTable
CREATE TABLE [dbo].[BoOutflowLine] (
    [id] NVARCHAR(1000) NOT NULL,
    [outflowId] NVARCHAR(1000) NOT NULL,
    [lineNo] INT NOT NULL,
    [itemNo] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [quantity] DECIMAL(18,6) NOT NULL,
    [unitPrice] DECIMAL(18,4) NOT NULL,
    [amount] DECIMAL(18,4) NOT NULL,
    [pump] NVARCHAR(1000),
    [hose] NVARCHAR(1000),
    CONSTRAINT [BoOutflowLine_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BoOutflowLine_outflowId_lineNo_key] UNIQUE NONCLUSTERED ([outflowId],[lineNo])
);

-- CreateTable
CREATE TABLE [dbo].[BoOutflowPayment] (
    [id] NVARCHAR(1000) NOT NULL,
    [outflowId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [amount] DECIMAL(18,4) NOT NULL,
    CONSTRAINT [BoOutflowPayment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BoOutflowPayment_outflowId_code_key] UNIQUE NONCLUSTERED ([outflowId],[code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoOutflow_shiftDate_idx] ON [dbo].[BoOutflow]([shiftDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoOutflow_shiftNo_idx] ON [dbo].[BoOutflow]([shiftNo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoOutflow_storeCode_idx] ON [dbo].[BoOutflow]([storeCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoOutflowLine_outflowId_idx] ON [dbo].[BoOutflowLine]([outflowId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoOutflowPayment_outflowId_idx] ON [dbo].[BoOutflowPayment]([outflowId]);

-- AddForeignKey
ALTER TABLE [dbo].[BoOutflowLine] ADD CONSTRAINT [BoOutflowLine_outflowId_fkey] FOREIGN KEY ([outflowId]) REFERENCES [dbo].[BoOutflow]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[BoOutflowPayment] ADD CONSTRAINT [BoOutflowPayment_outflowId_fkey] FOREIGN KEY ([outflowId]) REFERENCES [dbo].[BoOutflow]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
