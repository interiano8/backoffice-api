/*
  Warnings:

  - You are about to drop the `BoOutflow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BoOutflowLine` table. If the table is not empty, all the data it contains will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[BoOutflowLine] DROP CONSTRAINT [BoOutflowLine_outflowId_fkey];

-- AlterTable
ALTER TABLE [dbo].[BoSale] ADD [saleHeaderId] NVARCHAR(1000);

-- DropTable
DROP TABLE [dbo].[BoOutflow];

-- DropTable
DROP TABLE [dbo].[BoOutflowLine];

-- CreateTable
CREATE TABLE [dbo].[BoSaleHeader] (
    [id] NVARCHAR(1000) NOT NULL,
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [BoSaleHeader_source_df] DEFAULT 'TPV',
    [storeCode] NVARCHAR(1000) NOT NULL,
    [transactionId] NVARCHAR(1000) NOT NULL,
    [docType] INT NOT NULL,
    [docNo] NVARCHAR(1000) NOT NULL,
    [shiftDate] DATETIME2 NOT NULL,
    [shiftNo] NVARCHAR(1000) NOT NULL,
    [employeeName] NVARCHAR(1000) NOT NULL,
    [customerNo] NVARCHAR(1000),
    [customerName] NVARCHAR(1000),
    [rtn] NVARCHAR(1000),
    [subTotal] DECIMAL(18,4) NOT NULL,
    [totalAmount] DECIMAL(18,4) NOT NULL,
    [km] NVARCHAR(1000),
    [orden] NVARCHAR(1000),
    [placa] NVARCHAR(1000),
    [chofer] NVARCHAR(1000),
    [reconcilerShiftId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BoSaleHeader_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BoSaleHeader_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BoSaleHeader_source_storeCode_transactionId_key] UNIQUE NONCLUSTERED ([source],[storeCode],[transactionId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSaleHeader_shiftDate_idx] ON [dbo].[BoSaleHeader]([shiftDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSaleHeader_shiftNo_idx] ON [dbo].[BoSaleHeader]([shiftNo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSaleHeader_storeCode_idx] ON [dbo].[BoSaleHeader]([storeCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSaleHeader_reconcilerShiftId_idx] ON [dbo].[BoSaleHeader]([reconcilerShiftId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSaleHeader_docType_idx] ON [dbo].[BoSaleHeader]([docType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSale_saleHeaderId_idx] ON [dbo].[BoSale]([saleHeaderId]);

-- AddForeignKey
ALTER TABLE [dbo].[BoSale] ADD CONSTRAINT [BoSale_saleHeaderId_fkey] FOREIGN KEY ([saleHeaderId]) REFERENCES [dbo].[BoSaleHeader]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
