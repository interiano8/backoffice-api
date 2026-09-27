BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[BoHose] DROP CONSTRAINT [BoHose_storeCode_df];

-- AlterTable
ALTER TABLE [dbo].[BoPaymentMethod] DROP CONSTRAINT [BoPaymentMethod_storeCode_df];

-- AlterTable
ALTER TABLE [dbo].[BoSale] DROP CONSTRAINT [BoSale_storeCode_df];

-- AlterTable
ALTER TABLE [dbo].[BoShift] DROP CONSTRAINT [BoShift_storeCode_df];

-- AlterTable
ALTER TABLE [dbo].[BoStore] ADD [apiUrl] NVARCHAR(1000),
[lanUrl] NVARCHAR(1000);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
