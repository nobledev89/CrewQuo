const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found!');
  console.error('Please download it from Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Your company ID (from console logs)
const COMPANY_ID = 'corporate-spec';

async function seedTestData() {
  console.log('🌱 Starting to seed test data...\n');

  try {
    // 1. Create Clients
    console.log('📋 Creating clients...');
    const clients = [
      {
        name: 'Acme Corporation',
        email: 'contact@acme.com',
        phone: '+1 555-0101',
        address: '123 Main St, New York, NY 10001',
        notes: 'Large commercial client',
        active: true,
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        name: 'TechStart Inc',
        email: 'info@techstart.io',
        phone: '+1 555-0202',
        address: '456 Tech Blvd, San Francisco, CA 94102',
        notes: 'Tech startup renovation',
        active: true,
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        name: 'BuildRight LLC',
        email: 'admin@buildright.com',
        phone: '+1 555-0303',
        address: '789 Construction Ave, Chicago, IL 60601',
        notes: 'Construction company office',
        active: true,
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    ];

    const clientIds: string[] = [];
    for (const client of clients) {
      const docRef = await db.collection('clients').add(client);
      clientIds.push(docRef.id);
      console.log(`  ✅ Created client: ${client.name} (${docRef.id})`);
    }

    // 2. Create Projects
    console.log('\n📁 Creating projects...');
    const projects = [
      {
        projectCode: 'PROJ-001',
        name: 'Office Renovation',
        location: 'New York, NY',
        status: 'ACTIVE',
        startDate: Timestamp.fromDate(new Date('2024-01-15')),
        endDate: Timestamp.fromDate(new Date('2024-06-30')),
        notes: 'Complete office renovation including electrical and plumbing',
        clientId: clientIds[0], // Acme Corporation
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        projectCode: 'PROJ-002',
        name: 'Warehouse Construction',
        location: 'New York, NY',
        status: 'ACTIVE',
        startDate: Timestamp.fromDate(new Date('2024-02-01')),
        endDate: Timestamp.fromDate(new Date('2024-12-31')),
        notes: 'New warehouse facility construction',
        clientId: clientIds[0], // Acme Corporation
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        projectCode: 'PROJ-003',
        name: 'Tech Hub Setup',
        location: 'San Francisco, CA',
        status: 'ACTIVE',
        startDate: Timestamp.fromDate(new Date('2024-03-01')),
        endDate: Timestamp.fromDate(new Date('2024-08-15')),
        notes: 'Modern tech office setup with smart systems',
        clientId: clientIds[1], // TechStart Inc
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        projectCode: 'PROJ-004',
        name: 'Corporate HQ Build',
        location: 'Chicago, IL',
        status: 'ON_HOLD',
        startDate: Timestamp.fromDate(new Date('2024-04-01')),
        endDate: Timestamp.fromDate(new Date('2025-03-31')),
        notes: 'New headquarters building - currently on hold due to permits',
        clientId: clientIds[2], // BuildRight LLC
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        projectCode: 'PROJ-005',
        name: 'Retail Store Fitout',
        location: 'Chicago, IL',
        status: 'COMPLETED',
        startDate: Timestamp.fromDate(new Date('2023-09-01')),
        endDate: Timestamp.fromDate(new Date('2023-12-15')),
        notes: 'Retail space fitout - successfully completed',
        clientId: clientIds[2], // BuildRight LLC
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    ];

    for (const project of projects) {
      const docRef = await db.collection('projects').add(project);
      console.log(`  ✅ Created project: ${project.name} (${docRef.id})`);
    }

    // 3. Create Subcontractors
    console.log('\n👷 Creating subcontractors...');
    const subcontractors = [
      {
        name: 'John Smith',
        email: 'john@electricpro.com',
        phone: '+1 555-1001',
        notes: 'Licensed electrician with 15 years experience',
        active: true,
        type: 'manual',
        companyName: 'ElectricPro Services',
        companyAddress: '100 Volt St, New York, NY',
        taxId: 'EIN-12-3456789',
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah@plumbingexperts.com',
        phone: '+1 555-1002',
        notes: 'Master plumber, specializes in commercial projects',
        active: true,
        type: 'manual',
        companyName: 'Plumbing Experts LLC',
        companyAddress: '200 Pipe Ave, New York, NY',
        taxId: 'EIN-98-7654321',
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        name: 'Mike Davis',
        email: 'mike@hvacpros.com',
        phone: '+1 555-1003',
        notes: 'HVAC specialist',
        active: true,
        type: 'manual',
        companyName: 'HVAC Pros Inc',
        companyAddress: '300 Cool St, Chicago, IL',
        taxId: 'EIN-11-2233445',
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        name: 'Emily Chen',
        email: 'emily@carpentrycraft.com',
        phone: '+1 555-1004',
        notes: 'Custom carpentry and woodwork specialist',
        active: true,
        type: 'manual',
        companyName: 'Carpentry Craft',
        companyAddress: '400 Wood Ln, San Francisco, CA',
        taxId: 'EIN-55-6677889',
        companyId: COMPANY_ID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    ];

    for (const subcontractor of subcontractors) {
      const docRef = await db.collection('subcontractors').add(subcontractor);
      console.log(`  ✅ Created subcontractor: ${subcontractor.name} (${docRef.id})`);
    }

    console.log('\n✨ Test data seeded successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • ${clients.length} clients`);
    console.log(`   • ${projects.length} projects`);
    console.log(`   • ${subcontractors.length} subcontractors`);
    console.log('\n💡 Now you can test the client selector functionality!');
    console.log('   1. Refresh your dashboard');
    console.log('   2. Click the client dropdown');
    console.log('   3. Select different clients to see filtered projects');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Run the script
seedTestData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
