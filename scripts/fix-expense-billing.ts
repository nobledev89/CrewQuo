/**
 * Script to fix expense billing amounts and margins
 * Updates all existing expenses to calculate proper client billing based on rate card markups
 */

import * as admin from 'firebase-admin';
import * as serviceAccount from '../service-account-key.json';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

interface ExpenseData {
  id: string;
  companyId: string;
  projectId: string;
  clientId?: string;
  subcontractorId: string;
  category: string;
  amount: number;
  quantity: number;
  unitRate?: number;
  payRateCardId?: string;
  billRateCardId?: string;
  clientBillAmount?: number;
  marginValue?: number;
  marginPercentage?: number;
}

async function fixExpenseBilling() {
  console.log('🔧 Starting expense billing fix...\n');

  try {
    // Fetch all expenses
    const expensesSnapshot = await db.collection('expenses').get();
    console.log(`Found ${expensesSnapshot.size} total expenses\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let alreadyFixedCount = 0;

    const batch = db.batch();
    let batchCount = 0;
    const MAX_BATCH_SIZE = 500;

    for (const expenseDoc of expensesSnapshot.docs) {
      const expense = expenseDoc.data() as ExpenseData;
      expense.id = expenseDoc.id;

      // Skip if already has billing amount
      if (expense.clientBillAmount !== undefined && expense.clientBillAmount !== null) {
        alreadyFixedCount++;
        continue;
      }

      try {
        const cost = expense.amount || 0;
        let clientBillAmount = cost; // Default to pass-through
        let marginValue = 0;
        let marginPercentage = 0;

        // Try to find rate card assignment for this subcontractor/client combo
        if (expense.companyId && expense.subcontractorId && expense.clientId) {
          const assignmentsQuery = await db
            .collection('subcontractorRateAssignments')
            .where('companyId', '==', expense.companyId)
            .where('subcontractorId', '==', expense.subcontractorId)
            .where('clientId', '==', expense.clientId)
            .limit(1)
            .get();

          if (!assignmentsQuery.empty) {
            const assignment = assignmentsQuery.docs[0].data();
            const payRateCardId = assignment.payRateCardId || assignment.rateCardId;
            const billRateCardId = assignment.billRateCardId;

            // Fetch rate cards
            let payCard: any = null;
            let billCard: any = null;

            if (payRateCardId) {
              const payCardDoc = await db.collection('rateCards').doc(payRateCardId).get();
              if (payCardDoc.exists) {
                payCard = payCardDoc.data();
              }
            }

            if (billRateCardId) {
              const billCardDoc = await db.collection('rateCards').doc(billRateCardId).get();
              if (billCardDoc.exists) {
                billCard = billCardDoc.data();
              }
            }

            // Find matching expense entry in pay card
            const matchingPayExpense = payCard?.expenses?.find(
              (e: any) => e.categoryName === expense.category
            );

            // Find matching expense entry in bill card
            const matchingBillExpense = billCard?.expenses?.find(
              (e: any) => e.categoryName === expense.category
            );

            if (matchingPayExpense && matchingBillExpense) {
              const rateType = matchingPayExpense.rateType || 'CAPPED';
              const quantity = expense.quantity || 1;

              if (rateType === 'CAPPED') {
                // For CAPPED expenses: apply markup percentage to actual amount
                const markupPct = matchingBillExpense.marginPercentage || 0;
                clientBillAmount = cost * (1 + markupPct / 100);
              } else {
                // For FIXED expenses: use client rate
                const clientRate = matchingBillExpense.clientRate || matchingBillExpense.rate || cost / quantity;
                clientBillAmount = clientRate * quantity;
              }

              // Calculate margin
              marginValue = clientBillAmount - cost;
              marginPercentage = clientBillAmount > 0 ? (marginValue / clientBillAmount) * 100 : 0;

              console.log(`✅ ${expense.id}: ${expense.category} - Cost: £${cost.toFixed(2)} → Bill: £${clientBillAmount.toFixed(2)} (Margin: £${marginValue.toFixed(2)}, ${marginPercentage.toFixed(1)}%)`);
            } else {
              console.log(`⚠️  ${expense.id}: No matching rate card expense found for category "${expense.category}" - keeping pass-through`);
              skippedCount++;
              continue;
            }
          } else {
            console.log(`⚠️  ${expense.id}: No rate card assignment found - keeping pass-through`);
            skippedCount++;
            continue;
          }
        } else {
          console.log(`⚠️  ${expense.id}: Missing required fields (companyId, subcontractorId, or clientId)`);
          skippedCount++;
          continue;
        }

        // Update the expense
        batch.update(expenseDoc.ref, {
          clientBillAmount,
          marginValue,
          marginPercentage,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        updatedCount++;
        batchCount++;

        // Commit batch if we reach the limit
        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          console.log(`\n📦 Committed batch of ${batchCount} updates\n`);
          batchCount = 0;
        }
      } catch (error) {
        console.error(`❌ Error processing expense ${expense.id}:`, error);
        errorCount++;
      }
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n📦 Committed final batch of ${batchCount} updates\n`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Expense Billing Fix Complete!');
    console.log('='.repeat(60));
    console.log(`Total expenses: ${expensesSnapshot.size}`);
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`🔵 Already fixed: ${alreadyFixedCount}`);
    console.log(`⚠️  Skipped (no rate card): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
fixExpenseBilling()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
