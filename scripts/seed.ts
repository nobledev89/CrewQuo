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
  console.log('🌱 Starting seed...');

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

  // Create Role Catalog
  const roles = [
    { id: 'electrician', name: 'Electrician', description: 'Licensed electrician' },
    { id: 'plumber', name: 'Plumber', description: 'Licensed plumber' },
    { id: 'carpenter', name: 'Carpenter', description: 'General carpentry' },
    { id: 'project-manager', name: 'Project Manager', description: 'Site management' },
  ];

  for (const role of roles) {
    await db.collection('roleCatalog').doc(role.id).set({
      companyId,
      name: role.name,
      description: role.description,
    });
  }
  console.log('✅ Created roles');

  // Create Client: PwC
  const clientRef = db.collection('clients').doc('pwc');
  await clientRef.set({
    companyId,
    name: 'PwC',
    contactEmail: 'projects@pwc.com',
    currency: 'GBP',
    notes: 'Major client - accounting firm',
    createdAt: Timestamp.now(),
  });
  console.log('✅ Created client: PwC');

  // Create Subcontractors
  const subcontractors = [
    { id: 'john-smith', name: 'John Smith', email: 'john@example.com', phone: '+44 7700 900123' },
    { id: 'jane-doe', name: 'Jane Doe', email: 'jane@example.com', phone: '+44 7700 900456' },
  ];

  for (const sub of subcontractors) {
    await db.collection('subcontractors').doc(sub.id).set({
      companyId,
      name: sub.name,
      email: sub.email,
      phone: sub.phone,
      active: true,
      notes: '',
      createdAt: Timestamp.now(),
    });
  }
  console.log('✅ Created subcontractors');

  // Create Project
  const projectRef = db.collection('projects').doc('pwc-office-refit');
  await projectRef.set({
    companyId,
    clientId: 'pwc',
    projectCode: 'PWC-2024-001',
    name: 'PwC Office Refit',
    location: 'London, EC1',
    startDate: Timestamp.fromDate(new Date('2024-01-01')),
    endDate: null,
    status: 'ACTIVE',
    notes: 'Complete office renovation',
    createdAt: Timestamp.now(),
  });
  console.log('✅ Created project: PwC Office Refit');

  // Create Project Assignments
  for (const sub of subcontractors) {
    await db.collection('projectAssignments').add({
      companyId,
      projectId: 'pwc-office-refit',
      subcontractorId: sub.id,
      createdAt: Timestamp.now(),
    });
  }
  console.log('✅ Created project assignments');

  // Create Rate Cards for Subcontractor: John Smith (Electrician)
  const subRates = [
    {
      targetType: 'SUBCONTRACTOR',
      targetId: 'john-smith',
      roleId: 'electrician',
      rateMode: 'HOURLY',
      rateLabel: 'Mon–Fri Day',
      hourlyRate: 35,
      otHourlyRate: 52.5,
      effectiveFrom: Timestamp.fromDate(new Date('2024-01-01')),
    },
    {
      targetType: 'SUBCONTRACTOR',
      targetId: 'john-smith',
      roleId: 'electrician',
      rateMode: 'HOURLY',
      rateLabel: 'Mon–Thurs Night',
      hourlyRate: 45,
      otHourlyRate: 67.5,
      effectiveFrom: Timestamp.fromDate(new Date('2024-01-01')),
    },
    {
      targetType: 'SUBCONTRACTOR',
      targetId: 'john-smith',
      roleId: 'electrician',
      rateMode: 'HOURLY',
      rateLabel: 'Sunday',
      hourlyRate: 55,
      otHourlyRate: 82.5,
      effectiveFrom: Timestamp.fromDate(new Date('2024-01-01')),
    },
  ];

  // Create Rate Cards for Client: PwC (Electrician)
  const clientRates = [
    {
      targetType: 'CLIENT',
      targetId: 'pwc',
      roleId: 'electrician',
      rateMode: 'HOURLY',
      rateLabel: 'Mon–Fri Day',
      hourlyRate: 65,
      otHourlyRate: 97.5,
      effectiveFrom: Timestamp.fromDate(new Date('2024-01-01')),
    },
    {
      targetType: 'CLIENT',
      targetId: 'pwc',
      roleId: 'electrician',
      rateMode: 'HOURLY',
      rateLabel: 'Mon–Thurs Night',
      hourlyRate: 85,
      otHourlyRate: 127.5,
      effectiveFrom: Timestamp.fromDate(new Date('2024-01-01')),
    },
    {
      targetType: 'CLIENT',
      targetId: 'pwc',
      roleId: 'electrician',
      rateMode: 'HOURLY',
      rateLabel: 'Sunday',
      hourlyRate: 105,
      otHourlyRate: 157.5,
      effectiveFrom: Timestamp.fromDate(new Date('2024-01-01')),
    },
  ];

  for (const rate of [...subRates, ...clientRates]) {
    await db.collection('rateCards').add({
      companyId,
      ...rate,
      currency: 'GBP',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log('✅ Created rate cards');

  // Create Sample Time Log
  await db.collection('timeLogs').add({
    companyId,
    projectId: 'pwc-office-refit',
    subcontractorId: 'john-smith',
    roleId: 'electrician',
    date: Timestamp.fromDate(new Date('2024-12-10')),
    shiftType: 'WEEKDAY_DAY',
    hoursRegular: 8,
    hoursOT: 2,
    notes: 'Electrical wiring installation',
    subRateLabel: 'Mon–Fri Day',
    clientRateLabel: 'Mon–Fri Day',
    subBaseRate: 35,
    subOTRate: 52.5,
    clientBillRate: 65,
    clientOTBillRate: 97.5,
    subCost: 385, // (35 * 8) + (52.5 * 2)
    clientBill: 715, // (65 * 8) + (97.5 * 2)
    marginValue: 330,
    marginPct: 46.15,
    currency: 'GBP',
    status: 'APPROVED',
    createdByUserId: 'admin-user',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('✅ Created sample time log');

  // Create Sample Expenses
  await db.collection('expenses').add({
    companyId,
    projectId: 'pwc-office-refit',
    date: Timestamp.fromDate(new Date('2024-12-10')),
    category: 'PARKING',
    description: 'Parking at site',
    amount: 15.50,
    currency: 'GBP',
    status: 'APPROVED',
    createdByUserId: 'admin-user',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await db.collection('expenses').add({
    companyId,
    projectId: 'pwc-office-refit',
    date: Timestamp.fromDate(new Date('2024-12-11')),
    category: 'PARTS',
    description: 'Electrical cables and connectors',
    amount: 287.50,
    currency: 'GBP',
    status: 'SUBMITTED',
    createdByUserId: 'admin-user',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  console.log('✅ Created sample expenses');

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log('  - Company: Corporate Spec');
  console.log('  - Roles: 4');
  console.log('  - Client: PwC');
  console.log('  - Subcontractors: 2');
  console.log('  - Project: PwC Office Refit');
  console.log('  - Rate Cards: 6');
  console.log('  - Time Logs: 1 (APPROVED)');
  console.log('  - Expenses: 2 (1 APPROVED, 1 SUBMITTED)');
  console.log('');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
