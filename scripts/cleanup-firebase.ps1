# Firebase Cleanup Script
# This script deletes all Firestore collections and Authentication users

Write-Host "🧹 Starting Firebase cleanup for project: projects-corporatespec" -ForegroundColor Cyan
Write-Host "⚠️  This will delete ALL data from Firestore and Authentication!" -ForegroundColor Yellow
Write-Host ""

$projectId = "projects-corporatespec"

# List of collections to delete
$collections = @(
    "users",
    "companies",
    "roleCatalog",
    "clients",
    "subcontractors",
    "projects",
    "projectAssignments",
    "rateCards",
    "rateCardTemplates",
    "timeLogs",
    "expenses",
    "invoices",
    "notifications",
    "auditLogs"
)

Write-Host "📦 Deleting Firestore collections..." -ForegroundColor Cyan

foreach ($collection in $collections) {
    Write-Host "   Deleting collection: $collection" -ForegroundColor Gray
    
    # Delete collection recursively with auto-confirmation
    firebase firestore:delete $collection --project $projectId --recursive --force 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Deleted collection: $collection" -ForegroundColor Green
    } else {
        Write-Host "   ⚪ Collection '$collection' may not exist or is already empty" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "🎉 Firestore cleanup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Note: Authentication users cannot be bulk deleted via Firebase CLI." -ForegroundColor Yellow
Write-Host "   Please use one of these methods to delete auth users:" -ForegroundColor Yellow
Write-Host "   1. Firebase Console: https://console.firebase.google.com/project/$projectId/authentication/users" -ForegroundColor Gray
Write-Host "   2. Use the cleanup script with proper credentials (FIREBASE_ADMIN_* environment variables)" -ForegroundColor Gray
Write-Host ""
Write-Host "✨ Database collections are now clean and ready for new data!" -ForegroundColor Green
