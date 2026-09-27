BEGIN TRY

BEGIN TRAN;

-- AddForeignKey
ALTER TABLE [dbo].[BoPaymentMethod] ADD CONSTRAINT [BoPaymentMethod_source_storeCode_transactionId_fkey] FOREIGN KEY ([source], [storeCode], [transactionId]) REFERENCES [dbo].[BoSaleHeader]([source],[storeCode],[transactionId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
