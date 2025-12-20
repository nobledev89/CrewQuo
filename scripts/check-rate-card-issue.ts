import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

async function checkRateCardIssue() {
  console.log('🔍 Investigating Rate Card Issue for Pashe Solutions Ltd...\n');

  try {
    // Step 1: Find the subcontractor "Pashe Solutions Ltd"
    console.log('Step 1: Finding Pashe Solutions Ltd subcontractor...');
    const subcontractorsSnap = await db
      .collection('subcontractors')
      .where('name', '==', 'Pashe Solutions Ltd')
      .get();

    if (subcontractorsSnap.empty) {
      console.log('❌ No subcontractor found with name "Pashe Solutions Ltd"');
      return;
    }

    const subcontractor = subcontractorsSnap.docs[0];
    const subData = subcontractor.data();
    console.log('✅ Found subcontractor:');
    console.log(`   ID: ${subcontractor.id}`);
    console.log(`   Name: ${subData.name}`);
    console.log(`   Email: ${subData.email}`);
    console.log(`   Company ID: ${subData.companyId}\n`);

    // Step 2: Find the client "PricewaterhouseCoopers"
    console.log('Step 2: Finding PricewaterhouseCoopers client...');
    const clientsSnap = await db
      .collection('clients')
      .where('companyId', '==', subData.companyId)
      .where('name', '==', 'PricewaterhouseCoopers')
      .get();

    if (clientsSnap.empty) {
      console.log('❌ No client found with name "PricewaterhouseCoopers"');
      return;
    }

    const client = clientsSnap.docs[0];
    const clientData = client.data();
    console.log('✅ Found client:');
    console.log(`   ID: ${client.id}`);
    console.log(`   Name: ${clientData.name}\n`);

    // Step 3: Find rate assignment for this subcontractor and client
    console.log('Step 3: Checking rate card assignment...');
    const rateAssignmentsSnap = await db
      .collection('subcontractorRateAssignments')
      .where('companyId', '==', subData.companyId)
      .where('subcontractorId', '==', subcontractor.id)
      .where('clientId', '==', client.id)
      .get();

    if (rateAssignmentsSnap.empty) {
      console.log('❌ NO RATE CARD ASSIGNMENT FOUND!');
      console.log('   This is the problem - the subcontractor has no rate card assigned for this client.');
      console.log('   Solution: Assign a rate card through the UI or create an assignment.\n');
      return;
    }

    const rateAssignment = rateAssignmentsSnap.docs[0];
    const assignmentData = rateAssignment.data();
    console.log('✅ Found rate assignment:');
    console.log(`   Assignment ID: ${rateAssignment.id}`);
    console.log(`   Pay Rate Card ID: ${assignmentData.payRateCardId || assignmentData.rateCardId || 'NOT SET'}`);
    console.log(`   Bill Rate Card ID: ${assignmentData.billRateCardId || 'NOT SET'}`);
    console.log(`   Assigned on: ${assignmentData.assignedDate?.toDate?.() || 'Unknown'}\n`);

    const payRateCardId = assignmentData.payRateCardId || assignmentData.rateCardId;

    if (!payRateCardId) {
      console.log('❌ RATE ASSIGNMENT EXISTS BUT NO PAY RATE CARD ID!');
      console.log('   The assignment record exists but payRateCardId/rateCardId is null or missing.\n');
      return;
    }

    // Step 4: Get the rate card details
    console.log('Step 4: Fetching rate card details...');
    const rateCardDoc = await db.collection('rateCards').doc(payRateCardId).get();

    if (!rateCardDoc.exists) {
      console.log('❌ RATE CARD NOT FOUND!');
      console.log(`   The rate card ID "${payRateCardId}" doesn't exist in the database.`);
      console.log('   Solution: Assign a valid rate card.\n');
      return;
    }

    const rateCard = rateCardDoc.data();
    console.log('✅ Found rate card:');
    console.log(`   ID: ${rateCardDoc.id}`);
    console.log(`   Name: ${rateCard?.name}`);
    console.log(`   Card Type: ${rateCard?.cardType}`);
    console.log(`   Active: ${rateCard?.active}`);
    console.log(`   Description: ${rateCard?.description || 'None'}`);

    // Step 5: Check the rates array
    console.log('\nStep 5: Checking rate entries...');
    const rates = rateCard?.rates || [];
    console.log(`   Number of rate entries: ${rates.length}`);

    if (rates.length === 0) {
      console.log('\n❌ FOUND THE PROBLEM!');
      console.log('   The rate card has NO RATE ENTRIES (empty rates array).');
      console.log('   This is why the dropdown is empty - there are no shift types to choose from.\n');
      console.log('   SOLUTION:');
      console.log('   1. Go to Rate Cards page in the UI');
      console.log(`   2. Edit the rate card "${rateCard?.name}"`);
      console.log('   3. Click "Add Rate Entry"');
      console.log('   4. Fill in at least:');
      console.log('      - Role/Resource Name (e.g., "Fitter", "Supervisor")');
      console.log('      - Category (e.g., "Labour")');
      console.log('      - Shift Type (e.g., "Monday-Friday Standard Hours (1x)")');
      console.log('      - Base Rate (e.g., 15.00)');
      console.log('   5. Save the rate card\n');
    } else {
      console.log('✅ Rate card HAS rate entries. Details:\n');
      rates.forEach((rate: any, index: number) => {
        console.log(`   Entry ${index + 1}:`);
        console.log(`      Role Name: ${rate.roleName}`);
        console.log(`      Category: ${rate.category}`);
        console.log(`      Shift Type: ${rate.shiftType}`);
        console.log(`      Base Rate: £${rate.baseRate || 0}`);
        console.log(`      Hourly Rate: £${rate.hourlyRate || 'Not set'}`);
        console.log('');
      });
      console.log('   The rate card looks good! The issue might be elsewhere.');
      console.log('   Check if the rate card data is being properly passed to the component.\n');
    }

    // Step 6: Check if there are any expenses configured
    console.log('Step 6: Checking expense entries...');
    const expenses = rateCard?.expenses || [];
    console.log(`   Number of expense entries: ${expenses.length}`);
    if (expenses.length > 0) {
      console.log('   Expense categories configured:\n');
      expenses.forEach((exp: any) => {
        console.log(`      - ${exp.categoryName}: £${exp.rate} (${exp.unitType})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRateCardIssue()
  .then(() => {
    console.log('\n✅ Investigation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
