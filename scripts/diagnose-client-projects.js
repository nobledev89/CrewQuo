"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
// Initialize Firebase Admin
const serviceAccount = require(path.resolve(__dirname, '../firebase-service-account.json'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}
const db = admin.firestore();
function diagnoseClientProjects() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🔍 Investigating client-project mismatch...\n');
            const clientId = 'h3Os4IWCHgNwzu8Wlo5g';
            // 1. Get the client document
            console.log('📋 Step 1: Fetching client document...');
            const clientDoc = yield db.collection('clients').doc(clientId).get();
            if (!clientDoc.exists) {
                console.log('❌ Client document does NOT exist!');
                console.log(`   Client ID: ${clientId}`);
                // Search for any client with similar name
                console.log('\n🔎 Searching for clients with name "PricewaterhouseCoopers"...');
                const clientsSnapshot = yield db.collection('clients')
                    .where('name', '==', 'PricewaterhouseCoopers')
                    .get();
                if (clientsSnapshot.empty) {
                    console.log('   No clients found with that exact name.');
                    // Try case-insensitive search
                    console.log('\n🔎 Searching for clients with name containing "pricewaterhouse"...');
                    const allClients = yield db.collection('clients').get();
                    const matchingClients = allClients.docs.filter(doc => { var _a; return (_a = doc.data().name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('pricewaterhouse'); });
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
                    }
                    else {
                        console.log('   No clients found with similar names.');
                    }
                }
                else {
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
            }
            else {
                const clientData = clientDoc.data();
                console.log('✅ Client document exists:');
                console.log(`   ID: ${clientId}`);
                console.log(`   Name: ${clientData === null || clientData === void 0 ? void 0 : clientData.name}`);
                console.log(`   Company ID: ${clientData === null || clientData === void 0 ? void 0 : clientData.companyId}`);
                console.log(`   Active: ${clientData === null || clientData === void 0 ? void 0 : clientData.active}`);
                console.log(`   ClientOrgId: ${(clientData === null || clientData === void 0 ? void 0 : clientData.clientOrgId) || 'None'}`);
                console.log('');
                // 2. Search for projects with this client
                console.log('📋 Step 2: Searching for projects with this clientId...');
                const projectsSnapshot = yield db.collection('projects')
                    .where('clientId', '==', clientId)
                    .get();
                if (projectsSnapshot.empty) {
                    console.log('❌ No projects found with this clientId!');
                }
                else {
                    console.log(`✅ Found ${projectsSnapshot.size} project(s):`);
                    projectsSnapshot.forEach(doc => {
                        const data = doc.data();
                        console.log(`   - ${data.name} (${data.projectCode})`);
                    });
                }
                console.log('');
                // 3. Search for projects with this client name
                console.log('📋 Step 3: Searching for all projects with client name containing "Pricewaterhouse"...');
                const allProjects = yield db.collection('projects')
                    .where('companyId', '==', clientData === null || clientData === void 0 ? void 0 : clientData.companyId)
                    .get();
                const matchingProjects = allProjects.docs.filter(doc => {
                    var _a;
                    const data = doc.data();
                    // Check if clientName exists and matches
                    return (_a = data.clientName) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('pricewaterhouse');
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
                }
                else {
                    console.log('   No projects found with matching client name.');
                    // List all projects for this company
                    console.log(`\n📋 All projects for company ${clientData === null || clientData === void 0 ? void 0 : clientData.companyId}:`);
                    allProjects.forEach(doc => {
                        const data = doc.data();
                        console.log(`   - ${data.name} (Client: ${data.clientName || 'Unknown'})`);
                    });
                }
            }
            console.log('\n✅ Diagnosis complete!');
        }
        catch (error) {
            console.error('Error during diagnosis:', error);
        }
        finally {
            process.exit(0);
        }
    });
}
diagnoseClientProjects();
