import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin with Application Default Credentials
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'projects-corporatespec',
  });
}

const db = admin.firestore();

async function createDummyUserAndSeedData() {
  console.log('🚀 Creating dummy user and seeding data in LIVE Firebase database...');
  console.log('📍 Project: projects-corporatespec');
  console.log('');

  const email = 'admin@corporatespec.com';
  const password = 'Password12345';
  const companyId = 'corporate-spec';

  try {
    // ===== CREATE/UPDATE ADMIN USER IN AUTH =====
    console.log('👤 Creating admin user in Firebase Auth...');
    
    let userRecord;
    try {
      // Check if user already exists
      userRecord = await admin.auth().getUserByEmail(email);
      console.log(`⚠️  User ${email} already exists with UID: ${userRecord.uid}`);
      console.log('Updating custom claims...');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        userRecord = await admin.auth().createUser({
          email,
          password,
          emailVerified: true,
          displayName: 'Corporate Spec Admin',
        });
        console.log(`✅ Created user: ${email} with UID: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      companyId,
      role: 'ADMIN',
    });
    console.log('✅ Custom claims set successfully!');

    // ===== SEED DATABASE =====
    console.log('');
    console.log('🌱 Starting database seed...');

    // Create Company: Corporate Spec
    const companyRef = db.collection('companies').doc('corporate-spec');
    await companyRef.set({
      name: 'Corporate Spec',
      slug: 'corporate-spec',
      plan: 'enterprise',
      currency: 'GBP',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });
    console.log('✅ Created/updated company: Corporate Spec');

    // Create Admin User Document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      companyId,
      email,
      name: 'Corporate Spec Admin',
      role: 'ADMIN',
      createdAt: Timestamp.now(),
    }, { merge: true });
    console.log('✅ Created/updated admin user document');

    // Create Role Catalog
    const roles = [
      { id: 'supervisor-heavy-gang-foreman', name: 'Supervisor/heavy gang foreman', description: 'Site supervisor and heavy gang foreman' },
      { id: 'foreman-heavy-gang-porter', name: 'Foreman/heavy gang porter', description: 'Foreman and heavy gang porter' },
      { id: 'fitter-supervisor', name: 'Fitter Supervisor(Specialist)', description: 'Specialist fitter supervisor' },
      { id: 'fitter', name: 'Fitter', description: 'General fitter' },
      { id: 'driver', name: 'Driver', description: 'Site driver' },
      { id: 'export-packer', name: 'Export packer', description: 'Export packing specialist' },
      { id: 'porter', name: 'Porter', description: 'General porter' },
      { id: 'luton-van', name: 'Luton Van', description: 'Luton van with driver' },
    ];

    for (const role of roles) {
      await db.collection('roleCatalog').doc(role.id).set({
        companyId,
        name: role.name,
        description: role.description,
      }, { merge: true });
    }
    console.log('✅ Created 8 role types');

    // Create Client: PriceWater Coopers (PwC)
    await db.collection('clients').doc('pwc').set({
      companyId,
      name: 'PriceWater Coopers (PwC)',
      contactEmail: 'projects@pwc.com',
      currency: 'GBP',
      notes: 'Major accounting firm client',
      createdAt: Timestamp.now(),
    }, { merge: true });
    console.log('✅ Created client: PriceWater Coopers (PwC)');

    // Create Subcontractors
    const subcontractors = [
      { 
        id: 'hanmore-family', 
        name: 'Hanmore & Family Ltd', 
        email: 'contact@hanmorefamily.com', 
        phone: '+44 7700 900100',
        notes: 'Reliable subcontractor with good track record'
      },
      { 
        id: 'pashe-solutions', 
        name: 'Pashe Solutions Ltd', 
        email: 'info@pashesolutions.com', 
        phone: '+44 7700 900200',
        notes: 'Specialist solutions provider'
      },
    ];

    for (const sub of subcontractors) {
      await db.collection('subcontractors').doc(sub.id).set({
        companyId,
        name: sub.name,
        email: sub.email,
        phone: sub.phone,
        active: true,
        notes: sub.notes,
        createdAt: Timestamp.now(),
      }, { merge: true });
    }
    console.log('✅ Created 2 subcontractors');

    // Create Project
    await db.collection('projects').doc('pwc-office-renovation').set({
      companyId,
      clientId: 'pwc',
      projectCode: 'PWC-2025-001',
      name: 'PwC Office Renovation',
      location: 'London, UK',
      startDate: Timestamp.fromDate(new Date('2025-01-01')),
      endDate: null,
      status: 'ACTIVE',
      notes: 'Major office renovation project',
      createdAt: Timestamp.now(),
    }, { merge: true });
    console.log('✅ Created project: PwC Office Renovation');

    // Create Project Assignments
    const assignments = await db.collection('projectAssignments')
      .where('companyId', '==', companyId)
      .where('projectId', '==', 'pwc-office-renovation')
      .get();

    if (assignments.empty) {
      for (const sub of subcontractors) {
        await db.collection('projectAssignments').add({
          companyId,
          projectId: 'pwc-office-renovation',
          subcontractorId: sub.id,
          createdAt: Timestamp.now(),
        });
      }
      console.log('✅ Created project assignments');
    } else {
      console.log('✅ Project assignments already exist');
    }

    // ===== RATE CARDS =====
    const pwcClientRates = [
      // Supervisor/heavy gang foreman
      { roleId: 'supervisor-heavy-gang-foreman', rateLabel: 'Mon-fri (1st 8 hours)', hourlyRate: 23.75, otHourlyRate: 35.63 },
      { roleId: 'supervisor-heavy-gang-foreman', rateLabel: 'Friday & Saturday nights', hourlyRate: 47.50, otHourlyRate: 71.25 },
      { roleId: 'supervisor-heavy-gang-foreman', rateLabel: 'Sat & Mon-Thurs nights', hourlyRate: 35.63, otHourlyRate: 53.45 },
      { roleId: 'supervisor-heavy-gang-foreman', rateLabel: 'Sunday', hourlyRate: 47.50, otHourlyRate: 71.25 },
      // Foreman/heavy gang porter
      { roleId: 'foreman-heavy-gang-porter', rateLabel: 'Mon-fri (1st 8 hours)', hourlyRate: 20.24, otHourlyRate: 30.36 },
      { roleId: 'foreman-heavy-gang-porter', rateLabel: 'Friday & Saturday nights', hourlyRate: 40.48, otHourlyRate: 60.72 },
      { roleId: 'foreman-heavy-gang-porter', rateLabel: 'Sat & Mon-Thurs nights', hourlyRate: 30.36, otHourlyRate: 45.54 },
      { roleId: 'foreman-heavy-gang-porter', rateLabel: 'Sunday', hourlyRate: 40.48, otHourlyRate: 60.72 },
      // Fitter Supervisor(Specialist)
      { roleId: 'fitter-supervisor', rateLabel: 'Mon-fri (1st 8 hours)', hourlyRate: 25.63, otHourlyRate: 38.45 },
      { roleId: 'fitter-supervisor', rateLabel: 'Friday & Saturday nights', hourlyRate: 51.26, otHourlyRate: 76.89 },
      { roleId: 'fitter-supervisor', rateLabel: 'Sat & Mon-Thurs nights', hourlyRate: 38.45, otHourlyRate: 57.68 },
      { roleId: 'fitter-supervisor', rateLabel: 'Sunday', hourlyRate: 51.26, otHourlyRate: 76.89 },
      // Fitter
      { roleId: 'fitter', rateLabel: 'Mon-fri (1st 8 hours)', hourlyRate: 22.35, otHourlyRate: 33.53 },
      { roleId: 'fitter', rateLabel: 'Friday & Saturday nights', hourlyRate: 44.70, otHourlyRate: 67.05 },
      { roleId: 'fitter', rateLabel: 'Sat & Mon-Thurs nights', hourlyRate: 33.53, otHourlyRate: 50.30 },
      { roleId: 'fitter', rateLabel: 'Sunday', hourlyRate: 44.70, otHourlyRate: 67.05 },
      // Driver
      { roleId: 'driver', rateLabel: 'Mon-fri (1st 8 hours)', hourlyRate: 24.79, otHourlyRate: 37.19 },
      { roleId: 'driver', rateLabel: 'Friday & Saturday nights', hourlyRate: 49.58, otHourlyRate: 74.37 },
      { roleId: 'driver', rateLabel: 'Sat & Mon-Thurs nights', hourlyRate: 37.19, otHourlyRate: 55.79 },
      { roleId: 'driver', rateLabel: 'Sunday', hourlyRate: 49.58, otHourlyRate: 74.37 },
      // Export packer
      { roleId: 'export-packer', rateLabel: 'Mon-fri (1st 8 hours)', hourlyRate: 19.29, otHourlyRate: 28.94 },
      { roleId: 'export-packer', rateLabel: 'Friday & Saturday nights', hourlyRate: 38.58, otHourlyRate: 57.87 },
      { roleId: 'export-packer', rateLabel: 'Sat & Mon-Thurs nights', hourlyRate: 28.94, otHourlyRate: 43.41 },
      { roleId: 'export-packer', rateLabel: 'Sunday', hourlyRate: 38.58, otHourlyRate: 57.87 },
      // Porter
      { roleId: 'porter', rateLabel: 'Mon-fri (1st 8 hours)', hourlyRate: 16.69, otHourlyRate: 25.04 },
      { roleId: 'porter', rateLabel: 'Friday & Saturday nights', hourlyRate: 33.38, otHourlyRate: 50.07 },
      { roleId: 'porter', rateLabel: 'Sat & Mon-Thurs nights', hourlyRate: 25.04, otHourlyRate: 37.56 },
      { roleId: 'porter', rateLabel: 'Sunday', hourlyRate: 33.38, otHourlyRate: 50.07 },
      // Luton Van
      { roleId: 'luton-van', rateLabel: 'Mon-fri (1st 8 hours)', hourlyRate: 210.00, otHourlyRate: 315.00 },
    ];

    const hanmoreRates = pwcClientRates.map(rate => ({
      ...rate,
      hourlyRate: Number((rate.hourlyRate * 0.80).toFixed(2)),
      otHourlyRate: Number((rate.otHourlyRate * 0.80).toFixed(2)),
    }));

    const pasheRates = pwcClientRates.map(rate => ({
      ...rate,
      hourlyRate: Number((rate.hourlyRate * 0.75).toFixed(2)),
      otHourlyRate: Number((rate.otHourlyRate * 0.75).toFixed(2)),
    }));

    // Check if rate cards already exist
    const existingRates = await db.collection('rateCards')
      .where('companyId', '==', companyId)
      .limit(1)
      .get();

    if (existingRates.empty) {
      // Insert PwC Client Rate Cards
      for (const rate of pwcClientRates) {
        await db.collection('rateCards').add({
          companyId,
          targetType: 'CLIENT',
          targetId: 'pwc',
          roleId: rate.roleId,
          rateMode: 'HOURLY',
          rateLabel: rate.rateLabel,
          hourlyRate: rate.hourlyRate,
          otHourlyRate: rate.otHourlyRate,
          effectiveFrom: Timestamp.fromDate(new Date('2025-01-01')),
          currency: 'GBP',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      console.log(`✅ Created ${pwcClientRates.length} rate cards for PwC (CLIENT)`);

      // Insert Hanmore & Family Ltd Subcontractor Rate Cards
      for (const rate of hanmoreRates) {
        await db.collection('rateCards').add({
          companyId,
          targetType: 'SUBCONTRACTOR',
          targetId: 'hanmore-family',
          roleId: rate.roleId,
          rateMode: 'HOURLY',
          rateLabel: rate.rateLabel,
          hourlyRate: rate.hourlyRate,
          otHourlyRate: rate.otHourlyRate,
          effectiveFrom: Timestamp.fromDate(new Date('2025-01-01')),
          currency: 'GBP',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      console.log(`✅ Created ${hanmoreRates.length} rate cards for Hanmore & Family Ltd (SUBCONTRACTOR)`);

      // Insert Pashe Solutions Ltd Subcontractor Rate Cards
      for (const rate of pasheRates) {
        await db.collection('rateCards').add({
          companyId,
          targetType: 'SUBCONTRACTOR',
          targetId: 'pashe-solutions',
          roleId: rate.roleId,
          rateMode: 'HOURLY',
          rateLabel: rate.rateLabel,
          hourlyRate: rate.hourlyRate,
          otHourlyRate: rate.otHourlyRate,
          effectiveFrom: Timestamp.fromDate(new Date('2025-01-01')),
          currency: 'GBP',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      console.log(`✅ Created ${pasheRates.length} rate cards for Pashe Solutions Ltd (SUBCONTRACTOR)`);
    } else {
      console.log('✅ Rate cards already exist');
    }

    // Create sample time log
    const existingLogs = await db.collection('timeLogs')
      .where('companyId', '==', companyId)
      .where('projectId', '==', 'pwc-office-renovation')
      .limit(1)
      .get();

    if (existingLogs.empty) {
      await db.collection('timeLogs').add({
        companyId,
        projectId: 'pwc-office-renovation',
        subcontractorId: 'hanmore-family',
        roleId: 'fitter',
        date: Timestamp.fromDate(new Date('2025-01-15')),
        shiftType: 'WEEKDAY_DAY',
        hoursRegular: 8,
        hoursOT: 2,
        notes: 'Installation work on site',
        subRateLabel: 'Mon-fri (1st 8 hours)',
        clientRateLabel: 'Mon-fri (1st 8 hours)',
        subBaseRate: 17.88,
        subOTRate: 26.82,
        clientBillRate: 22.35,
        clientOTBillRate: 33.53,
        subCost: 196.68,
        clientBill: 245.86,
        marginValue: 49.18,
        marginPct: 20.0,
        currency: 'GBP',
        status: 'APPROVED',
        createdByUserId: userRecord.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      console.log('✅ Created sample time log');
    } else {
      console.log('✅ Sample time log already exists');
    }

    console.log('');
    console.log('🎉 Successfully created dummy user and seeded LIVE database!');
    console.log('');
    console.log('📊 Summary:');
    console.log('  - Database: LIVE (projects-corporatespec)');
    console.log('  - Company: Corporate Spec');
    console.log(`  - Admin User: ${email}`);
    console.log(`  - Password: ${password}`);
    console.log(`  - User UID: ${userRecord.uid}`);
    console.log('  - Roles: 8 (from rate card)');
    console.log('  - Client: PriceWater Coopers (PwC)');
    console.log('  - Subcontractors: 2 (Hanmore & Family Ltd, Pashe Solutions Ltd)');
    console.log('  - Project: PwC Office Renovation');
    console.log('  - Rate Cards: Complete set for all entities');
    console.log('  - Time Logs: Sample log included');
    console.log('');
    console.log('✨ You can now login with these credentials!');
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

createDummyUserAndSeedData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
