@echo off
echo Starting Roof Detection Application...
echo.

echo Installing Python dependencies...
pip install -r requirements.txt
echo.

echo Installing backend dependencies...
cd backend
call npm install
echo.

echo Installing frontend dependencies...
cd ../frontend
call npm install
echo.

echo.
echo ========================================
echo Setup complete!
echo.
echo To start the application:
echo 1. Open a terminal and run: cd backend && npm start
echo 2. Open another terminal and run: cd frontend && npm start
echo.
echo Backend will run on http://localhost:5000
echo Frontend will run on http://localhost:3000
echo ========================================
pause



