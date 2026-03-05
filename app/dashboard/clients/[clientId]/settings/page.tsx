'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Settings, Save, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  getContractorClientRelationship,
  createContractorClientRelationship,
} from '@/lib/clientAccessUtils';

interface Client {
  id: string;
  name: string;
  clientOrgId?: string;
  clientOrgName?: string;
}

interface VisibilitySettings {
  defaultShowCosts: boolean;
  defaultShowMargins: boolean;
  defaultShowSubcontractorRates: boolean;
  allowClientNotes: boolean;
  showDraftStatus: boolean;
  showRejectedStatus: boolean;
}

export default function ClientSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.clientId as string;

  const [client, setClient] = useState<Client | null>(null);
  const [settings, setSettings] = useState<VisibilitySettings>({
    defaultShowCosts: false,
    defaultShowMargins: false,
    defaultShowSubcontractorRates: false,
    allowClientNotes: true,
    showDraftStatus: true,
    showRejectedStatus: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUserId(currentUser.uid);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const compId = userData.companyId;
            setCompanyId(compId);
            setUserRole(userData.role);

            // Get company name
            const companyDoc = await getDoc(doc(db, 'companies', compId));
            if (companyDoc.exists()) {
              setCompanyName(companyDoc.data().name);
            }

            await fetchClient(clientId);
            await fetchSettings(compId, clientId);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [clientId]);

  const fetchClient = async (cId: string) => {
    try {
      const clientDoc = await getDoc(doc(db, 'clients', cId));
      if (clientDoc.exists()) {
        setClient({ id: clientDoc.id, ...clientDoc.data() } as Client);
      }
    } catch (error) {
      console.error('Error fetching client:', error);
    }
  };

  const fetchSettings = async (compId: string, cId: string) => {
    try {
      const clientDoc = await getDoc(doc(db, 'clients', cId));
      const clientData = clientDoc.data();
      const clientOrgId = clientData?.clientOrgId;

      if (!clientOrgId) return;

      const relationship = await getContractorClientRelationship(compId, clientOrgId);
      if (relationship) {
        setSettings({
          defaultShowCosts: relationship.defaultShowCosts,
          defaultShowMargins: relationship.defaultShowMargins,
          defaultShowSubcontractorRates: relationship.defaultShowSubcontractorRates,
          allowClientNotes: relationship.allowClientNotes,
          showDraftStatus: relationship.showDraftStatus,
          showRejectedStatus: relationship.showRejectedStatus,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSave = async () => {
    if (!client?.clientOrgId) {
      alert('Please invite a client user first to set up the client organization.');
      return;
    }

    setSaving(true);
    try {
      await createContractorClientRelationship(
        companyId,
        companyName,
        client.clientOrgId,
        client.clientOrgName || client.name,
        client.id,
        userId,
        settings
      );

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = userRole === 'ADMIN' || userRole === 'MANAGER';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-12 text-center">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Client not found</h3>
            <button
              onClick={() => router.push('/dashboard/clients')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Clients</span>
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/clients')}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Clients</span>
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{client.name}</h2>
              <p className="text-gray-600">Client Portal Visibility Settings</p>
            </div>
          </div>
        </div>

        {!client.clientOrgId && (
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 mb-6">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>No client organization linked yet.</strong> Invite a client user first to enable settings.
            </p>
            <button
              onClick={() => router.push(`/dashboard/clients/${clientId}/users`)}
              className="mt-3 inline-flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm"
            >
              <span>Invite Client User</span>
            </button>
          </div>
        )}

        {client.clientOrgId && (
          <>
            {/* Financial Visibility */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <Eye className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">Financial Visibility</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Control what financial information this client can see in the portal.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900">Show Subcontractor Costs</p>
                    <p className="text-sm text-gray-600">Display what you pay subcontractors</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.defaultShowCosts}
                      onChange={(e) => setSettings({ ...settings, defaultShowCosts: e.target.checked })}
                      disabled={!canEdit}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900">Show Profit Margins</p>
                    <p className="text-sm text-gray-600">Display margin amounts and percentages</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.defaultShowMargins}
                      onChange={(e) => setSettings({ ...settings, defaultShowMargins: e.target.checked })}
                      disabled={!canEdit}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900">Show Subcontractor Rate Details</p>
                    <p className="text-sm text-gray-600">Display hourly rates and rate card breakdowns</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.defaultShowSubcontractorRates}
                      onChange={(e) => setSettings({ ...settings, defaultShowSubcontractorRates: e.target.checked })}
                      disabled={!canEdit}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Status Visibility */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <Settings className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">Status Visibility</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Control which work statuses are visible to this client.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900">Show Draft Status</p>
                    <p className="text-sm text-gray-600">Display unsubmitted time logs and expenses</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showDraftStatus}
                      onChange={(e) => setSettings({ ...settings, showDraftStatus: e.target.checked })}
                      disabled={!canEdit}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900">Show Rejected Status</p>
                    <p className="text-sm text-gray-600">Display rejected items that need fixing</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showRejectedStatus}
                      onChange={(e) => setSettings({ ...settings, showRejectedStatus: e.target.checked })}
                      disabled={!canEdit}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Collaboration Features */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <Settings className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">Collaboration Features</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Enable collaboration tools for this client.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900">Allow Client Notes</p>
                    <p className="text-sm text-gray-600">Let clients add notes and questions on line items</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.allowClientNotes}
                      onChange={(e) => setSettings({ ...settings, allowClientNotes: e.target.checked })}
                      disabled={!canEdit}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
              <p className="text-sm text-blue-800">
                💡 <strong>Note:</strong> These are default settings for all projects. You can override these on a per-project basis in the Projects tab.
              </p>
            </div>

            {/* Save Button */}
            {canEdit && (
              <div className="flex items-center justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  <Save className="w-5 h-5" />
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
