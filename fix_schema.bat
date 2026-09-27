@echo off
echo Updating database schema...
cd %~dp0
call npx prisma db push
echo.
echo Database update complete. Please restart your backend server if it doesn't reload automatically.
pause
