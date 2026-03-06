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
import { UserPlus, Mail, CheckCircle, Clock, X, ArrowLeft, XCircle, Copy, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  getOrCreateClientOrganization,
  linkClientToOrganization,
  createContractorClientRelationship,
  createClientUserInvite,
  cancelClientUserInvite,
  deleteClientUserInvite,
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
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');

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
      // Only fetch invites if client has an organization
      if (!client?.clientOrgId) {
        setInvites([]);
        return;
      }

      const invitesQuery = query(
        collection(db, 'clientUserInvites'),
        where('contractorCompanyId', '==', compId),
        where('clientOrgId', '==', client.clientOrgId)
      );
      const invitesSnap = await getDocs(invitesQuery);
      const invitesList = invitesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Invite));
      
      // Sort by sentAt, newest first
      invitesList.sort((a, b) => {
        const aTime = a.sentAt?.toMillis ? a.sentAt.toMillis() : 0;
        const bTime = b.sentAt?.toMillis ? b.sentAt.toMillis() : 0;
        return bTime - aTime;
      });
      
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

      // Step 2: Create invite and get the invite token
      const inviteToken = await createClientUserInvite(
        inviteForm.email,
        companyId,
        companyName,
        clientOrgId,
        clientOrgName || client.name,
        userId
      );

      // Step 3: Generate and show invite link
      const inviteLink = `${window.location.origin}/signup/client?token=${inviteToken}`;
      setGeneratedInviteLink(inviteLink);

      // Refresh data
      await fetchInvites(companyId, clientId);
      setShowInviteModal(false);
      setInviteForm({ email: '', firstName: '', lastName: '' });
      setShowInviteLinkModal(true);
    } catch (error) {
      console.error('Error sending invite:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteLink = `${window.location.origin}/signup/client?token=${token}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const copyGeneratedLink = () => {
    navigator.clipboard.writeText(generatedInviteLink);
    setTimeout(() => {
      setShowInviteLinkModal(false);
      setGeneratedInviteLink('');
    }, 1500);
  };

  const handleCancelInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Are you sure you want to cancel the invitation for ${email}?`)) {
      return;
    }

    try {
      await cancelClientUserInvite(inviteId);
      await fetchInvites(companyId, clientId);
    } catch (error) {
      console.error('Error cancelling invite:', error);
      alert('Failed to cancel invitation. Please try again.');
    }
  };

  const handleDeleteInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Are you sure you want to permanently delete the invitation for ${email}?`)) {
      return;
    }

    try {
      await deleteClientUserInvite(inviteId);
      await fetchInvites(companyId, clientId);
    } catch (error) {
      console.error('Error deleting invite:', error);
      alert('Failed to delete invitation. Please try again.');
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
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(invite.status)}
                      <div>
                        <p className="font-semibold text-gray-900">{invite.email}</p>
                        <p className="text-xs text-gray-500">
                          Sent {formatDate(invite.sentAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(invite.status)}`}>
                        {invite.status}
                      </span>
                      {canEdit && (invite.status === 'cancelled' || invite.status === 'expired') && (
                        <button
                          onClick={() => handleDeleteInvite(invite.id, invite.email)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {invite.status === 'pending' && (invite as any).inviteToken && canEdit && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-2">Invite Link:</p>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => copyInviteLink((invite as any).inviteToken)}
                          className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition text-sm"
                        >
                          <Copy className="w-4 h-4" />
                          <span>{copiedToken === (invite as any).inviteToken ? 'Copied!' : 'Copy Link'}</span>
                        </button>
                        <button
                          onClick={() => handleCancelInvite(invite.id, invite.email)}
                          className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                          title="Cancel Invitation"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
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
                    🔗 An invite link will be generated that you can share with the user. They'll use it to create their account and access the client portal.
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
                  {saving ? 'Creating...' : 'Create Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Link Modal */}
      {showInviteLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Invitation Created!</h3>
                <p className="text-gray-600">Share this link with the client user to complete their signup.</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
                <p className="text-xs text-gray-600 mb-2">Invite Link:</p>
                <div className="bg-white rounded p-3 border border-gray-300 mb-3">
                  <p className="text-sm text-gray-800 break-all font-mono">{generatedInviteLink}</p>
                </div>
                <button
                  onClick={copyGeneratedLink}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Copy className="w-5 h-5" />
                  <span>Copy Link</span>
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                You can also copy this link later from the invitations list below.
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
