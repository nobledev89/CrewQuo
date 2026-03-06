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
function fixProjectClientNames() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🔧 Fixing missing clientName fields in projects...\n');
            // Get all projects
            const projectsSnapshot = yield db.collection('projects').get();
            console.log(`📋 Found ${projectsSnapshot.size} total projects\n`);
            let fixedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            for (const projectDoc of projectsSnapshot.docs) {
                const projectData = projectDoc.data();
                const projectId = projectDoc.id;
                // Check if clientName is missing or is 'Unknown'
                if (!projectData.clientName || projectData.clientName === 'Unknown') {
                    try {
                        // Fetch the client document
                        const clientDoc = yield db.collection('clients').doc(projectData.clientId).get();
                        if (clientDoc.exists) {
                            const clientData = clientDoc.data();
                            // Update project with correct clientName
                            yield db.collection('projects').doc(projectId).update({
                                clientName: (clientData === null || clientData === void 0 ? void 0 : clientData.name) || 'Unknown',
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                            console.log(`✅ Fixed: ${projectData.name || projectId}`);
                            console.log(`   Client: ${(clientData === null || clientData === void 0 ? void 0 : clientData.name) || 'Unknown'}\n`);
                            fixedCount++;
                        }
                        else {
                            console.log(`⚠️  Skipped: ${projectData.name || projectId} - Client not found (${projectData.clientId})\n`);
                            skippedCount++;
                        }
                    }
                    catch (error) {
                        console.error(`❌ Error fixing ${projectData.name || projectId}:`, error);
                        errorCount++;
                    }
                }
                else {
                    skippedCount++;
                }
            }
            console.log('\n=== SUMMARY ===');
            console.log(`Total projects: ${projectsSnapshot.size}`);
            console.log(`Fixed: ${fixedCount}`);
            console.log(`Skipped: ${skippedCount}`);
            console.log(`Errors: ${errorCount}`);
            console.log('\n✅ Done!');
        }
        catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
        finally {
            process.exit(0);
        }
    });
}
fixProjectClientNames();
