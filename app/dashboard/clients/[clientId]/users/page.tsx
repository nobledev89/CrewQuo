'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { UserPlus, Mail, CheckCircle, Clock, X, ArrowLeft, XCircle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  getOrCreateClientOrganization,
  linkClientToOrganization,
  createContractorClientRelationship,
  createClientUserInvite,
} from '@/lib/clientAccessUtils';

interface Client {
  id: string;
  name: string;
  email: string;
  clientOrgId?: string;
  clientOrgName?: string;
  companyId: string;
}

interface ClientUser {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
  createdAt: any;
}

interface Invite {
  id: string;
  email: string;
  status: string;
  sentAt: any;
}

export default function ClientUsersPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.clientId as string;

  const [client, setClient] = useState<Client | null>(null);
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
  });
  const [saving, setSaving] = useState(false);

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
            await fetchClientUsers();
            await fetchInvites(compId, clientId);
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

  const fetchClientUsers = async () => {
    if (!client?.clientOrgId) return;

    try {
      const usersQuery = query(
        collection(db, 'clientUsers'),
        where('clientOrgId', '==', client.clientOrgId)
      );
      const usersSnap = await getDocs(usersQuery);
      const users = usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ClientUser));
      setClientUsers(users);
    } catch (error) {
      console.error('Error fetching client users:', error);
    }
  };

  const fetchInvites = async (compId: string, cId: string) => {
    try {
      const invitesQuery = query(
        collection(db, 'clientUserInvites'),
        where('contractorCompanyId', '==', compId)
      );
      const invitesSnap = await getDocs(invitesQuery);
      const invitesList = invitesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Invite));
      setInvites(invitesList);
    } catch (error) {
      console.error('Error fetching invites:', error);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !companyId) return;

    setSaving(true);
    try {
      // Step 1: Ensure client org exists
      let clientOrgId = client.clientOrgId;
      let clientOrgName = client.clientOrgName;

      if (!clientOrgId) {
        // Create client organization
        const clientOrg = await getOrCreateClientOrganization(
          client.name,
          client.id,
          companyId,
          userId,
          inviteForm.email.split('@')[1] // domain
        );
        clientOrgId = clientOrg.id;
        clientOrgName = clientOrg.name;

        // Link client to organization
        await linkClientToOrganization(client.id, clientOrgId, clientOrgName);

        // Create contractor-client relationship with default settings
        await createContractorClientRelationship(
          companyId,
          companyName,
          clientOrgId,
          clientOrgName,
          client.id,
          userId,
          {
            defaultShowCosts: false,
            defaultShowMargins: false,
            defaultShowSubcontractorRates: false,
            allowClientNotes: true,
            showDraftStatus: true,
            showRejectedStatus: true,
          }
        );

        // Update local state
        setClient({ ...client, clientOrgId, clientOrgName });
      }

      // Step 2: Create invite
      await createClientUserInvite(
        inviteForm.email,
        companyId,
        companyName,
        clientOrgId,
        clientOrgName || client.name,
        userId
      );

      // Step 3: TODO - Send email (would integrate with email service)
      alert(`Invitation sent to ${inviteForm.email}!\n\nNote: Email integration pending. Share the signup link manually.`);

      // Refresh data
      await fetchInvites(companyId, clientId);
      setShowInviteModal(false);
      setInviteForm({ email: '', firstName: '', lastName: '' });
    } catch (error) {
      console.error('Error sending invite:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-600" />;
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <p className="text-gray-600">Manage Client Portal Users</p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <UserPlus className="w-5 h-5" />
                <span>Invite Client User</span>
              </button>
            )}
          </div>
        </div>

        {/* Client Organization Info */}
        {client.clientOrgId && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Client Organization:</strong> {client.clientOrgName}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Users from this organization can access projects across multiple contractors.
            </p>
          </div>
        )}

        {!client.clientOrgId && (
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 mb-6">
            <p className="text-sm text-yellow-800">
              💡 <strong>No client organization linked yet.</strong> Invite a user to automatically create one.
            </p>
          </div>
        )}

        {/* Active Users */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Active Users</h3>
          {clientUsers.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No active users yet</p>
              <p className="text-sm text-gray-500 mt-1">Invite users to give them access to the client portal</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clientUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Role: {user.role} • Joined {formatDate(user.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      user.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {user.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invites */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Invitations</h3>
          {invites.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No invitations sent</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map(invite => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(invite.status)}
                    <div>
                      <p className="font-semibold text-gray-900">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        Sent {formatDate(invite.sentAt)}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(invite.status)}`}>
                    {invite.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Invite Client User</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="user@company.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={inviteForm.firstName}
                      onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={inviteForm.lastName}
                      onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-800">
                    📧 The user will receive an email invitation to join the client portal. They'll be able to view projects and track progress in real-time.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {saving ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
