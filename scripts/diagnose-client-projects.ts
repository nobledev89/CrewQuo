import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccount = require(path.resolve(__dirname, '../firebase-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function diagnoseClientProjects() {
  try {
    console.log('🔍 Investigating client-project mismatch...\n');

    const clientId = 'h3Os4IWCHgNwzu8Wlo5g';
    
    // 1. Get the client document
    console.log('📋 Step 1: Fetching client document...');
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      console.log('❌ Client document does NOT exist!');
      console.log(`   Client ID: ${clientId}`);
      
      // Search for any client with similar name
      console.log('\n🔎 Searching for clients with name "PricewaterhouseCoopers"...');
      const clientsSnapshot = await db.collection('clients')
        .where('name', '==', 'PricewaterhouseCoopers')
        .get();
      
      if (clientsSnapshot.empty) {
        console.log('   No clients found with that exact name.');
        
        // Try case-insensitive search
        console.log('\n🔎 Searching for clients with name containing "pricewaterhouse"...');
        const allClients = await db.collection('clients').get();
        const matchingClients = allClients.docs.filter(doc => 
          doc.data().name?.toLowerCase().includes('pricewaterhouse')
        );
        
        if (matchingClients.length > 0) {
          console.log(`   Found ${matchingClients.length} client(s) with similar names:`);
          matchingClients.forEach(doc => {
            const data = doc.data();
            console.log(`   - ID: ${doc.id}`);
            console.log(`     Name: ${data.name}`);
            console.log(`     Company ID: ${data.companyId}`);
            console.log(`     Active: ${data.active}`);
            console.log('');
          });
        } else {
          console.log('   No clients found with similar names.');
        }
      } else {
        console.log(`   Found ${clientsSnapshot.size} client(s) with exact name:`);
        clientsSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`   - ID: ${doc.id}`);
          console.log(`     Name: ${data.name}`);
          console.log(`     Company ID: ${data.companyId}`);
          console.log(`     Active: ${data.active}`);
          console.log(`     ClientOrgId: ${data.clientOrgId || 'None'}`);
          console.log('');
        });
      }
    } else {
      const clientData = clientDoc.data();
      console.log('✅ Client document exists:');
      console.log(`   ID: ${clientId}`);
      console.log(`   Name: ${clientData?.name}`);
      console.log(`   Company ID: ${clientData?.companyId}`);
      console.log(`   Active: ${clientData?.active}`);
      console.log(`   ClientOrgId: ${clientData?.clientOrgId || 'None'}`);
      console.log('');
      
      // 2. Search for projects with this client
      console.log('📋 Step 2: Searching for projects with this clientId...');
      const projectsSnapshot = await db.collection('projects')
        .where('clientId', '==', clientId)
        .get();
      
      if (projectsSnapshot.empty) {
        console.log('❌ No projects found with this clientId!');
      } else {
        console.log(`✅ Found ${projectsSnapshot.size} project(s):`);
        projectsSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`   - ${data.name} (${data.projectCode})`);
        });
      }
      console.log('');
      
      // 3. Search for projects with this client name
      console.log('📋 Step 3: Searching for all projects with client name containing "Pricewaterhouse"...');
      const allProjects = await db.collection('projects')
        .where('companyId', '==', clientData?.companyId)
        .get();
      
      const matchingProjects = allProjects.docs.filter(doc => {
        const data = doc.data();
        // Check if clientName exists and matches
        return data.clientName?.toLowerCase().includes('pricewaterhouse');
      });
      
      if (matchingProjects.length > 0) {
        console.log(`   Found ${matchingProjects.length} project(s) with matching client name:`);
        matchingProjects.forEach(doc => {
          const data = doc.data();
          console.log(`   - Project: ${data.name} (${data.projectCode})`);
          console.log(`     Project ID: ${doc.id}`);
          console.log(`     Client ID in project: ${data.clientId}`);
          console.log(`     Client Name in project: ${data.clientName || 'Not set'}`);
          console.log(`     Status: ${data.status}`);
          console.log('');
        });
      } else {
        console.log('   No projects found with matching client name.');
        
        // List all projects for this company
        console.log(`\n📋 All projects for company ${clientData?.companyId}:`);
        allProjects.forEach(doc => {
          const data = doc.data();
          console.log(`   - ${data.name} (Client: ${data.clientName || 'Unknown'})`);
        });
      }
    }
    
    console.log('\n✅ Diagnosis complete!');
    
  } catch (error) {
    console.error('Error during diagnosis:', error);
  } finally {
    process.exit(0);
  }
}

diagnoseClientProjects();
