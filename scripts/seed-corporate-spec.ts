import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-crewquo',
  });
}

const db = admin.firestore();

// Use emulator in development
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('🔥 Using Firestore Emulator');
}

async function seed() {
  console.log('🌱 Starting seed for Corporate Spec...');

  // Create Company: Corporate Spec
  const companyRef = db.collection('companies').doc('corporate-spec');
  await companyRef.set({
    name: 'Corporate Spec',
    slug: 'corporate-spec',
    plan: 'enterprise',
    currency: 'GBP',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('✅ Created company: Corporate Spec');

  const companyId = 'corporate-spec';

  // Create Admin User in Firestore (Auth user should be created separately)
  const adminUserId = 'admin-corporate-spec';
  await db.collection('users').doc(adminUserId).set({
    companyId,
    email: 'admin@corporatespec.com',
    name: 'Corporate Spec Admin',
    role: 'ADMIN',
    createdAt: Timestamp.now(),
  });
  console.log('✅ Created admin user document');

  // Create Role Catalog based on rate card
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
    });
  }
  console.log('✅ Created 8 role types');

  // Create Client: PriceWater Coopers (PwC)
  const clientRef = db.collection('clients').doc('pwc');
  await clientRef.set({
    companyId,
    name: 'PriceWater Coopers (PwC)',
    contactEmail: 'projects@pwc.com',
    currency: 'GBP',
    notes: 'Major accounting firm client',
    createdAt: Timestamp.now(),
  });
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
    });
  }
  console.log('✅ Created 2 subcontractors');

  // Create Project
  const projectRef = db.collection('projects').doc('pwc-office-renovation');
  await projectRef.set({
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
  });
  console.log('✅ Created project: PwC Office Renovation');

  // Create Project Assignments for both subcontractors
  for (const sub of subcontractors) {
    await db.collection('projectAssignments').add({
      companyId,
      projectId: 'pwc-office-renovation',
      subcontractorId: sub.id,
      createdAt: Timestamp.now(),
    });
  }
  console.log('✅ Created project assignments');

  // ===== RATE CARDS FROM IMAGE =====
  
  // PwC Client Rate Cards (from the image - 8-hour rates as hourly)
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
    
    // Luton Van (daily rate converted to hourly)
    { roleId: 'luton-van', rateLabel: 'Mon-fri (1st 8 hours)', hourlyRate: 210.00, otHourlyRate: 315.00 },
  ];

  // Hanmore & Family Ltd Subcontractor Rates (20% lower than client rates)
  const hanmoreRates = pwcClientRates.map(rate => ({
    ...rate,
    hourlyRate: Number((rate.hourlyRate * 0.80).toFixed(2)),
    otHourlyRate: Number((rate.otHourlyRate * 0.80).toFixed(2)),
  }));

  // Pashe Solutions Ltd Subcontractor Rates (25% lower than client rates)
  const pasheRates = pwcClientRates.map(rate => ({
    ...rate,
    hourlyRate: Number((rate.hourlyRate * 0.75).toFixed(2)),
    otHourlyRate: Number((rate.otHourlyRate * 0.75).toFixed(2)),
  }));

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
  console.log(`✅ Created ${hanmoreRates.length} rate cards for Hanmore & Family Ltd (SUBCONTRACTOR, 80% of client rates)`);

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
  console.log(`✅ Created ${pasheRates.length} rate cards for Pashe Solutions Ltd (SUBCONTRACTOR, 75% of client rates)`);

  // Create a sample time log
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
    subBaseRate: 17.88, // 80% of 22.35
    subOTRate: 26.82, // 80% of 33.53
    clientBillRate: 22.35,
    clientOTBillRate: 33.53,
    subCost: 196.68, // (17.88 * 8) + (26.82 * 2)
    clientBill: 245.86, // (22.35 * 8) + (33.53 * 2)
    marginValue: 49.18,
    marginPct: 20.0,
    currency: 'GBP',
    status: 'APPROVED',
    createdByUserId: adminUserId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('✅ Created sample time log');

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log('  - Company: Corporate Spec');
  console.log('  - Admin User: admin@corporatespec.com (Password: Password12345)');
  console.log('  - Roles: 8 (from rate card)');
  console.log('  - Client: PriceWater Coopers (PwC)');
  console.log('  - Subcontractors: 2 (Hanmore & Family Ltd, Pashe Solutions Ltd)');
  console.log('  - Project: PwC Office Renovation');
  console.log(`  - Rate Cards: ${pwcClientRates.length * 3} total (${pwcClientRates.length} for each entity)`);
  console.log('  - Time Logs: 1 sample log');
  console.log('');
  console.log('⚠️  NEXT STEPS:');
  console.log('  1. Create the admin user in Firebase Auth:');
  console.log('     Email: admin@corporatespec.com');
  console.log('     Password: Password12345');
  console.log('  2. Set custom claims for the admin user:');
  console.log('     npm run set-claims admin@corporatespec.com ADMIN corporate-spec');
  console.log('');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
