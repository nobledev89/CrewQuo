# Firebase Manual Check Guide - Rate Card Issue

This guide will walk you through manually checking your Firebase database to identify why shift types aren't appearing in the dropdown.

## Step 1: Access Firebase Console

1. **Go to**: [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. **Sign in** with your Google account
3. **Select your project** (the one shown in your `.firebaserc` file)

## Step 2: Open Firestore Database

1. In the left sidebar, click **"Firestore Database"** (or "Build" → "Firestore Database")
2. You'll see a list of collections

## Step 3: Find Your Subcontractor

1. Click on the **`subcontractors`** collection
2. **Search/scroll** to find "Pashe Solutions Ltd"
3. Click on that document to open it
4. **Note down** the following:
   - **Document ID** (the string at the top)
   - **companyId** field value
   - **email** field value

**Example:**
```
Document ID: abc123xyz
companyId: comp_456def
email: pashe123@gmail.com
```

## Step 4: Find the Client

1. Go back and click on the **`clients`** collection
2. **Apply a filter**:
   - Click "Add filter"
   - Field: `name`
   - Operator: `==`
   - Value: `PricewaterhouseCoopers`
3. Or manually search through the clients
4. **Note down**:
   - **Client Document ID**
   - **name** field (should be "PricewaterhouseCoopers")

**Example:**
```
Document ID: client_789ghi
name: PricewaterhouseCoopers
```

## Step 5: Check Rate Card Assignment

1. Click on the **`subcontractorRateAssignments`** collection
2. **Find the assignment** where:
   - `subcontractorId` = (your subcontractor Document ID from Step 3)
   - `clientId` = (your client Document ID from Step 4)
3. Click on that document
4. **Check these fields**:
   - `payRateCardId` or `rateCardId` - **THIS IS THE KEY!**
   - `billRateCardId` (optional)
   - `assignedDate`

**What to look for:**
```
✅ GOOD:
payRateCardId: "ratecard_xyz123"  ← Has a value

❌ BAD:
payRateCardId: null                ← Missing!
OR
payRateCardId: undefined           ← Missing!
OR
(field doesn't exist)              ← Missing!
```

5. **Copy the payRateCardId value** (e.g., "ratecard_xyz123")

## Step 6: Check the Rate Card

1. Go back and click on the **`rateCards`** collection
2. **Find and click** on the document with the ID you copied in Step 5
3. If the document doesn't exist → **PROBLEM FOUND!** The assigned rate card was deleted
4. If the document exists, expand it and look for the **`rates`** field

## Step 7: Inspect the Rates Array

This is the critical step! Look at the `rates` field:

**Scenario A: rates is an empty array**
```json
rates: []  ← PROBLEM! This is why the dropdown is empty
```
**Solution**: Add rate entries to this rate card through the UI

**Scenario B: rates array has entries**
```json
rates: [
  {
    roleName: "Fitter",
    shiftType: "Monday-Friday Standard Hours (1x)",
    category: "Labour",
    baseRate: 15,
    ...
  }
]
```
**If this shows entries**: The rate card is fine, the issue is elsewhere (possibly a caching or data fetching issue)

**Scenario C: rates field doesn't exist**
```
(no rates field visible)
```
**Problem**: Rate card structure is incorrect

## Step 8: Document Your Findings

Take screenshots or note down:

### My Findings:

**Subcontractor:**
- Document ID: `__________________`
- Company ID: `__________________`
- Name: Pashe Solutions Ltd

**Client:**
- Document ID: `__________________`
- Name: PricewaterhouseCoopers

**Rate Assignment:**
- Document ID: `__________________`
- payRateCardId: `__________________` (or NULL/missing?)
- Assignment exists: YES / NO

**Rate Card:**
- Document ID: `__________________`
- Name: `__________________`
- Card Type: `__________________`
- rates array length: `____` (how many entries?)
- rates is empty: YES / NO
- First rate entry details (if exists):
  - roleName: `__________________`
  - shiftType: `__________________`
  - baseRate: `__________________`

## Common Issues & Solutions

### Issue 1: payRateCardId is NULL or missing
**Cause**: Rate card assignment was not completed properly
**Solution**: 
1. Go to your UI → Clients → PricewaterhouseCoopers → Subcontractors
2. Click "Change Rate Card" on Pashe Solutions Ltd
3. Select a rate card and save

### Issue 2: Rate card document doesn't exist
**Cause**: The rate card was deleted after assignment
**Solution**: 
1. Reassign a different rate card through the UI
2. Or create a new rate card and assign it

### Issue 3: rates array is empty []
**Cause**: Rate card was created but no rate entries were added (THIS IS MOST LIKELY!)
**Solution**:
1. Go to Rate Cards page in UI
2. Find and edit the assigned rate card
3. Click "Add Rate Entry"
4. Fill in: Role Name, Shift Type, Base Rate
5. Save the rate card
6. Refresh the My Work page

### Issue 4: rates array has entries but dropdown still empty
**Cause**: Possible caching, data fetching, or code issue
**Solution**:
1. Hard refresh the My Work page (Ctrl+F5)
2. Log out and log back in
3. Check browser console (F12) for the debug output I added
4. The issue might be in how data is passed from parent to ProjectModal

## Quick Verification in Browser Console

When you open a project in My Work, press **F12** and look for:

```
🔍 Debug Info:
- Rate Assignment: {payRateCardId: "...", ...}
- Pay Rate Card ID: "ratecard_xyz123"
- Pay Card Object: {id: "...", name: "...", rates: [...]}
- Pay Card Rates Array: [...]
- Number of rate options: X
```

If "Number of rate options" is **0**, but Firebase shows the rates array has entries, then there's a data loading issue.

## Need Help?

After checking Firebase, provide me with:
1. Screenshot of the rate card document showing the `rates` field
2. Screenshot of the browser console debug output
3. Your findings from Step 8 above

This will help identify the exact issue!
