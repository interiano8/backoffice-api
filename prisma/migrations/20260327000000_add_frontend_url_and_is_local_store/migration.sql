BEGIN TRY

BEGIN TRAN;

-- Add new columns to BoStore
ALTER TABLE [dbo].[BoStore] ADD [frontendUrl] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[BoStore] ADD [isLocalStore] BIT NOT NULL CONSTRAINT [BoStore_isLocalStore_df] DEFAULT 0;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
    ROLLBACK TRAN;

DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
RAISERROR(@ErrorMessage, @ErrorSeverity, 1);

END CATCH
