@echo off
cd /d "%~dp0"

set /p MESSAGE=Commit message: 
if "%MESSAGE%"=="" set MESSAGE=update

git add .
git commit -m "%MESSAGE%"
git push -u origin main
