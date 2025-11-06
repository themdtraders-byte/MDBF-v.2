@echo off
echo Starting the development servers...

REM Starts the Next.js application in a new terminal window.
start "MD Business Flow - App" cmd /k "npm run dev"

REM Starts the Genkit AI server in another new terminal window.
start "MD Business Flow - AI Server" cmd /k "npm run genkit:watch"

echo Both development servers are starting in separate windows.
