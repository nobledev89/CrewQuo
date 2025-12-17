# Fix Build Permission Error (EPERM)

## The Issue
```
Error: EPERM: operation not permitted, open 'D:\CrewQuo\.next\trace'
```

This Windows permission error occurs when:
- VS Code or another process has files locked
- Antivirus is scanning the directory
- Previous build process didn't fully exit

## Solution: Try These Steps in Order

### Option 1: Close VS Code and Rebuild
```powershell
# 1. Close VS Code completely
# 2. Open PowerShell as Administrator
# 3. Navigate to project
cd D:\CrewQuo

# 4. Clean build directories
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "out" -Recurse -Force -ErrorAction SilentlyContinue

# 5. Build again
npm run build
```

### Option 2: Add .next to Antivirus Exclusions
1. Open Windows Security
2. Go to Virus & threat protection → Manage settings
3. Scroll to Exclusions → Add or remove exclusions
4. Add folder: `D:\CrewQuo\.next`
5. Add folder: `D:\CrewQuo\out`
6. Try building again

### Option 3: Use Process Explorer to Find Lock
1. Download [Process Explorer](https://learn.microsoft.com/en-us/sysinternals/downloads/process-explorer)
2. Run as Administrator
3. Press Ctrl+F and search for: `.next\trace`
4. Close any processes holding the file
5. Try building again

### Option 4: Restart Computer
Sometimes the simplest solution:
```powershell
# After restart
cd D:\CrewQuo
npm run build
```

### Option 5: Build with Different Output (Workaround)
If all else fails, we can modify the build process:

```powershell
# Set environment variable to skip trace
$env:NEXT_TELEMETRY_DISABLED=1
npm run build
```

## Quick Fix Script

Save this as `build-clean.ps1` and run it:

```powershell
# Stop any Node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait a moment
Start-Sleep -Seconds 2

# Clean directories
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "out" -Recurse -Force -ErrorAction SilentlyContinue

# Wait again
Start-Sleep -Seconds 1

# Build
npm run build
```

Run with:
```powershell
.\build-clean.ps1
```

## After Successful Build

You should see:
```
✓ Creating an optimized production build
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

And the `out` directory will be created with your static site.

## Still Not Working?

Try building in a different location:
```powershell
# Copy project to C: drive
xcopy D:\CrewQuo C:\temp\CrewQuo /E /I /H
cd C:\temp\CrewQuo
npm install
npm run build
```

Then copy the `out` directory back to your project.
