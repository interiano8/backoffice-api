/*
  Warnings:

  - You are about to alter the column `shiftDate` on the `BoPaymentMethod` table. The data in that column could be lost. The data in that column will be cast from `DateTime2` to `Date`.
  - You are about to alter the column `shiftDate` on the `BoReconciliation` table. The data in that column could be lost. The data in that column will be cast from `DateTime2` to `Date`.
  - You are about to alter the column `shiftDate` on the `BoSale` table. The data in that column could be lost. The data in that column will be cast from `DateTime2` to `Date`.
  - You are about to alter the column `shiftDate` on the `BoSaleHeader` table. The data in that column could be lost. The data in that column will be cast from `DateTime2` to `Date`.
  - You are about to alter the column `shiftDate` on the `BoShift` table. The data in that column could be lost. The data in that column will be cast from `DateTime2` to `Date`.

*/
BEGIN TRY

BEGIN TRAN;

-- DropIndex
DROP INDEX [BoPaymentMethod_shiftDate_idx] ON [dbo].[BoPaymentMethod];

-- DropIndex
DROP INDEX [BoSaleHeader_shiftDate_idx] ON [dbo].[BoSaleHeader];

-- DropIndex
DROP INDEX [BoShift_shiftDate_idx] ON [dbo].[BoShift];

-- DropIndex
ALTER TABLE [dbo].[BoShift] DROP CONSTRAINT [BoShift_source_storeCode_shiftDate_shiftNo_employeeName_key];

-- AlterTable
ALTER TABLE [dbo].[BoPaymentMethod] ALTER COLUMN [shiftDate] DATE NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[BoReconciliation] ALTER COLUMN [shiftDate] DATE NULL;

-- AlterTable
ALTER TABLE [dbo].[BoSale] ALTER COLUMN [shiftDate] DATE NULL;
ALTER TABLE [dbo].[BoSale] ADD [appliedDocNo] NVARCHAR(1000),
[discountPct] DECIMAL(18,4),
[docType] INT,
[fsAmount] DECIMAL(18,4),
[fsFinalVolume] DECIMAL(18,4),
[fsInitialVolume] DECIMAL(18,4),
[fsPPU] DECIMAL(18,4),
[fsShiftId] NVARCHAR(1000),
[fsVolume] DECIMAL(18,4);

-- AlterTable
ALTER TABLE [dbo].[BoSaleHeader] ALTER COLUMN [shiftDate] DATE NOT NULL;
ALTER TABLE [dbo].[BoSaleHeader] ADD [appliedDocNo] NVARCHAR(1000);

-- AlterTable
ALTER TABLE [dbo].[BoShift] ALTER COLUMN [shiftDate] DATE NOT NULL;
ALTER TABLE [dbo].[BoShift] ADD [fs_shift_ids] NVARCHAR(1000);

-- AlterTable
ALTER TABLE [dbo].[BoStore] ADD [RTN] NVARCHAR(1000),
[titulo] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[TankMeasurement] (
    [id] NVARCHAR(1000) NOT NULL,
    [storeCode] NVARCHAR(1000) NOT NULL,
    [shiftDate] DATE NOT NULL,
    [shiftNo] NVARCHAR(1000) NOT NULL,
    [tankId] NVARCHAR(1000) NOT NULL,
    [measureType] NVARCHAR(1000) NOT NULL,
    [height] DECIMAL(10,2) NOT NULL,
    [volume] DECIMAL(10,2) NOT NULL,
    [waterLevel] DECIMAL(10,2),
    [temperature] DECIMAL(5,2),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TankMeasurement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TankMeasurement_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BoPrintedReport] (
    [id] NVARCHAR(1000) NOT NULL,
    [storeCode] NVARCHAR(1000) NOT NULL,
    [shiftDate] DATE NOT NULL,
    [shiftNo] NVARCHAR(1000) NOT NULL,
    [employeeName] NVARCHAR(1000) NOT NULL,
    [printedBy] NVARCHAR(1000) NOT NULL,
    [printedAt] DATETIME2 NOT NULL CONSTRAINT [BoPrintedReport_printedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [stationName] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL CONSTRAINT [BoPrintedReport_version_df] DEFAULT 1,
    [turnoControlador] NVARCHAR(1000),
    [id_contadores] NVARCHAR(1000),
    [dataSnapshot] TEXT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BoPrintedReport_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BoPrintedReport_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoShift_shiftDate_idx] ON [dbo].[BoShift]([shiftDate]);

-- CreateIndex
ALTER TABLE [dbo].[BoShift] ADD CONSTRAINT [BoShift_source_storeCode_shiftDate_shiftNo_employeeName_key] UNIQUE NONCLUSTERED ([source], [storeCode], [shiftDate], [shiftNo], [employeeName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoPaymentMethod_shiftDate_idx] ON [dbo].[BoPaymentMethod]([shiftDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoSaleHeader_shiftDate_idx] ON [dbo].[BoSaleHeader]([shiftDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TankMeasurement_shiftDate_idx] ON [dbo].[TankMeasurement]([shiftDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TankMeasurement_storeCode_idx] ON [dbo].[TankMeasurement]([storeCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoPrintedReport_storeCode_idx] ON [dbo].[BoPrintedReport]([storeCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoPrintedReport_shiftDate_idx] ON [dbo].[BoPrintedReport]([shiftDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BoPrintedReport_shiftNo_idx] ON [dbo].[BoPrintedReport]([shiftNo]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
