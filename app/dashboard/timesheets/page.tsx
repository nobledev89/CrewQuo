'use client';

import { useEffect, useState, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  orderBy,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  FileText,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import type { ProjectSubmission, TimeLog, Expense, LineItemRejectionNote } from '@/lib/types';

interface ExpandedNote {
  timesheetId: string;
  itemId: string;
}

interface Subcontractor {
  id: string;
  name: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
}

interface TimesheetData {
  submission: ProjectSubmission;
  subcontractor: Subcontractor | null;
  project: Project | null;
  timeLogs: TimeLog[];
  expenses: Expense[];
  totalHours: number;
  totalAmount: number;
}

export default function TimesheetsPage() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [timesheets, setTimesheets] = useState<TimesheetData[]>([]);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('submitted');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<ExpandedNote | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) return;
        const userData = userDoc.data();
        setUserRole(userData.role);
        const activeId = userData.activeCompanyId || userData.companyId;
        setActiveCompanyId(activeId);

        // Only allow ADMIN and MANAGER roles
        if (userData.role !== 'ADMIN' && userData.role !== 'MANAGER') {
          setLoading(false);
          return;
        }

        await fetchTimesheets(activeId);
      } catch (err) {
        console.error('Error loading timesheets', err);
        setError('Failed to load timesheets');
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const fetchTimesheets = async (companyId: string) => {
    // Fetch all project submissions
    const submissionsSnap = await getDocs(
      query(
        collection(db, 'projectSubmissions'),
        where('companyId', '==', companyId),
        orderBy('submittedAt', 'desc')
      )
    );

    const timesheetsList: TimesheetData[] = [];

    for (const submissionDoc of submissionsSnap.docs) {
      const submission = submissionDoc.data() as ProjectSubmission;
      submission.id = submissionDoc.id;

      // Fetch subcontractor details
      const subconDoc = await getDoc(doc(db, 'subcontractors', submission.subcontractorId));
      const subcontractor = subconDoc.exists()
        ? (subconDoc.data() as Subcontractor)
        : null;

      // Fetch project details
      const projDoc = await getDoc(doc(db, 'projects', submission.projectId));
      const project = projDoc.exists()
        ? (projDoc.data() as Project)
        : null;

      // Fetch time logs
      const timeLogs: TimeLog[] = [];
      if (submission.timeLogIds && submission.timeLogIds.length > 0) {
        for (const logId of submission.timeLogIds) {
          const logDoc = await getDoc(doc(db, 'timeLogs', logId));
          if (logDoc.exists()) {
            timeLogs.push(logDoc.data() as TimeLog);
          }
        }
      }

      // Fetch expenses
      const expenses: Expense[] = [];
      if (submission.expenseIds && submission.expenseIds.length > 0) {
        for (const expId of submission.expenseIds) {
          const expDoc = await getDoc(doc(db, 'expenses', expId));
          if (expDoc.exists()) {
            expenses.push(expDoc.data() as Expense);
          }
        }
      }

      // Calculate totals
      const totalHours = timeLogs.reduce((sum, log) => sum + (log.hoursRegular || 0) + (log.hoursOT || 0), 0);
      const totalAmount = timeLogs.reduce((sum, log) => sum + (log.subCost || 0), 0) +
        expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

      timesheetsList.push({
        submission,
        subcontractor,
        project,
        timeLogs,
        expenses,
        totalHours,
        totalAmount,
      });
    }

    setTimesheets(timesheetsList);
  };

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(ts => {
      if (filter === 'all') return true;
      return ts.submission.status.toUpperCase() === filter.toUpperCase();
    });
  }, [timesheets, filter]);

  const handleApprove = async (timesheetId: string) => {
    setProcessingId(timesheetId);
    setError('');

    try {
      const batch = writeBatch(db);
      const timesheet = timesheets.find(ts => ts.submission.id === timesheetId);

      if (!timesheet) {
        setError('Timesheet not found');
        return;
      }

      // Update submission status
      batch.update(doc(db, 'projectSubmissions', timesheetId), {
        status: 'APPROVED',
        approvedAt: Timestamp.now(),
        approvedBy: auth.currentUser?.uid,
        updatedAt: Timestamp.now(),
      });

      // Update all time logs and expenses to APPROVED
      timesheet.timeLogs.forEach(log => {
        batch.update(doc(db, 'timeLogs', log.id), {
          status: 'APPROVED',
          updatedAt: Timestamp.now(),
        });
      });

      timesheet.expenses.forEach(exp => {
        batch.update(doc(db, 'expenses', exp.id), {
          status: 'APPROVED',
          updatedAt: Timestamp.now(),
        });
      });

      await batch.commit();
      setSuccess('Timesheet approved successfully');

      // Refresh data
      if (activeCompanyId) {
        await fetchTimesheets(activeCompanyId);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error approving timesheet:', err);
      setError('Failed to approve timesheet. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTimesheet = async (timesheetId: string) => {
    setProcessingId(timesheetId);
    setError('');

    try {
      const batch = writeBatch(db);
      const timesheet = timesheets.find(ts => ts.submission.id === timesheetId);

      if (!timesheet) {
        setError('Timesheet not found');
        return;
      }

      // Update submission status
      batch.update(doc(db, 'projectSubmissions', timesheetId), {
        status: 'REJECTED',
        updatedAt: Timestamp.now(),
      });

      // Update all time logs and expenses to REJECTED
      timesheet.timeLogs.forEach(log => {
        batch.update(doc(db, 'timeLogs', log.id), {
          status: 'REJECTED',
          updatedAt: Timestamp.now(),
        });
      });

      timesheet.expenses.forEach(exp => {
        batch.update(doc(db, 'expenses', exp.id), {
          status: 'REJECTED',
          updatedAt: Timestamp.now(),
        });
      });

      await batch.commit();
      setSuccess('Timesheet rejected');

      // Refresh data
      if (activeCompanyId) {
        await fetchTimesheets(activeCompanyId);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error rejecting timesheet:', err);
      setError('Failed to reject timesheet. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddLineNote = async (timesheetId: string, itemId: string, itemType: 'timeLog' | 'expense', note: string) => {
    if (!note.trim()) {
      setError('Please enter a note');
      return;
    }

    setProcessingId(`${timesheetId}_${itemId}`);
    setError('');

    try {
      const newNote: LineItemRejectionNote = {
        itemId,
        itemType,
        note: note.trim(),
        addedAt: Timestamp.now(),
      };

      const batch = writeBatch(db);
      const submissionRef = doc(db, 'projectSubmissions', timesheetId);
      const submissionDoc = await getDoc(submissionRef);

      if (!submissionDoc.exists()) {
        setError('Submission not found');
        return;
      }

      const existingNotes = (submissionDoc.data().lineItemRejectionNotes || []) as LineItemRejectionNote[];
      const notes = [...existingNotes, newNote];

      batch.update(submissionRef, {
        lineItemRejectionNotes: notes,
        updatedAt: Timestamp.now(),
      });

      await batch.commit();
      setSuccess('Note added successfully');
      setRejectionNotes({});
      setEditingNote(null);

      // Refresh data
      if (activeCompanyId) {
        await fetchTimesheets(activeCompanyId);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error adding note:', err);
      setError('Failed to add note. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const getLineNotes = (submission: ProjectSubmission, itemId: string): LineItemRejectionNote[] => {
    return (submission.lineItemRejectionNotes || []).filter(note => note.itemId === itemId);
  };

  const noteKey = editingNote ? `${editingNote.timesheetId}_${editingNote.itemId}` : '';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading timesheets...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="font-semibold text-red-800">Access Denied: Only admins and managers can access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Timesheet Approvals</h1>
          <p className="text-gray-600 mt-1">Review and approve subcontractor timesheets by project</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-2">
            {(['all', 'submitted', 'approved', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg transition font-medium ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Timesheets */}
        <div className="space-y-4">
          {filteredTimesheets.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No {filter !== 'all' ? filter : ''} timesheets</p>
              <p className="text-sm text-gray-500">Subcontractors haven't submitted any timesheets yet</p>
            </div>
          ) : (
            filteredTimesheets.map(timesheet => (
              <div key={timesheet.submission.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Timesheet Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {timesheet.subcontractor?.name || 'Unknown Contractor'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{timesheet.project?.name || 'Unknown Project'}</p>
                      {timesheet.subcontractor?.email && (
                        <p className="text-xs text-gray-500 mt-1">{timesheet.subcontractor.email}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-sm text-gray-600">Total Hours</p>
                          <p className="text-2xl font-bold text-gray-900">{timesheet.totalHours.toFixed(1)}h</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-2xl font-bold text-gray-900">£{timesheet.totalAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      timesheet.submission.status === 'SUBMITTED'
                        ? 'bg-yellow-100 text-yellow-700'
                        : timesheet.submission.status === 'APPROVED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {timesheet.submission.status}
                    </span>
                    {timesheet.submission.submittedAt && (
                      <span className="text-xs text-gray-600">
                        Submitted: {timesheet.submission.submittedAt.toDate().toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Description</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">Qty/Hrs</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Amount</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {/* Time Logs */}
                      {timesheet.timeLogs.map(log => {
                        const totalHours = (log.hoursRegular || 0) + (log.hoursOT || 0);
                        const dateObj = log.date?.toDate ? log.date.toDate() : (typeof log.date === 'object' ? log.date as any : new Date(log.date));
                        const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                        const notes = getLineNotes(timesheet.submission, log.id);
                        const isEditingNote = editingNote?.itemId === log.id && editingNote.timesheetId === timesheet.submission.id;

                        return (
                          <tr key={`log_${log.id}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-600">{dateStr}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">Time Log</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{log.roleName}</td>
                            <td className="px-6 py-4 text-center text-sm text-gray-900">
                              {log.hoursRegular.toFixed(1)}h
                              {log.hoursOT && log.hoursOT > 0 && (
                                <div className="text-xs text-orange-600 font-medium">+OT {log.hoursOT.toFixed(1)}h</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">£{log.subCost.toFixed(2)}</td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => {
                                  if (isEditingNote) {
                                    setEditingNote(null);
                                  } else {
                                    setEditingNote({
                                      timesheetId: timesheet.submission.id,
                                      itemId: log.id,
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                              >
                                <MessageSquare className="w-3 h-3" />
                                {notes.length > 0 ? notes.length : 'Add'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Expenses */}
                      {timesheet.expenses.map(exp => {
                        const dateObj = exp.date?.toDate ? exp.date.toDate() : (typeof exp.date === 'object' ? exp.date as any : new Date(exp.date));
                        const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                        const notes = getLineNotes(timesheet.submission, exp.id);
                        const isEditingNote = editingNote?.itemId === exp.id && editingNote.timesheetId === timesheet.submission.id;

                        return (
                          <tr key={`exp_${exp.id}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-600">{dateStr}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">Expense</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{exp.category}</td>
                            <td className="px-6 py-4 text-center text-sm text-gray-900">-</td>
                            <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">£{exp.amount.toFixed(2)}</td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => {
                                  if (isEditingNote) {
                                    setEditingNote(null);
                                  } else {
                                    setEditingNote({
                                      timesheetId: timesheet.submission.id,
                                      itemId: exp.id,
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                              >
                                <MessageSquare className="w-3 h-3" />
                                {notes.length > 0 ? notes.length : 'Add'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Notes Section */}
                {editingNote && editingNote.timesheetId === timesheet.submission.id && (
                  <div className="bg-blue-50 border-t border-gray-200 p-6">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Add Note
                    </label>
                    <textarea
                      value={rejectionNotes[noteKey] || ''}
                      onChange={(e) => setRejectionNotes({ ...rejectionNotes, [noteKey]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      rows={3}
                      placeholder="Enter note for this line item (e.g., 'Rate verification needed', 'Missing documentation')..."
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          const itemId = editingNote.itemId;
                          const itemType = timesheet.timeLogs.some(l => l.id === itemId) ? 'timeLog' : 'expense';
                          handleAddLineNote(timesheet.submission.id, itemId, itemType, rejectionNotes[noteKey] || '');
                        }}
                        disabled={processingId !== null || !rejectionNotes[noteKey]?.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Save Note
                      </button>
                      <button
                        onClick={() => {
                          setEditingNote(null);
                          setRejectionNotes({});
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Show Existing Notes */}
                {timesheet.submission.lineItemRejectionNotes && timesheet.submission.lineItemRejectionNotes.length > 0 && (
                  <div className="bg-amber-50 border-t border-gray-200 p-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Line Item Notes</h4>
                    <div className="space-y-3">
                      {timesheet.submission.lineItemRejectionNotes.map((note, idx) => {
                        const item = timesheet.timeLogs.find(l => l.id === note.itemId) ||
                          timesheet.expenses.find(e => e.id === note.itemId);
                        const itemName = note.itemType === 'timeLog'
                          ? (item as TimeLog)?.roleName
                          : (item as Expense)?.category;

                        return (
                          <div key={idx} className="bg-white p-3 rounded border border-amber-200">
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">{itemName}</span> ({note.itemType === 'timeLog' ? 'Time Log' : 'Expense'})
                            </p>
                            <p className="text-sm text-gray-900 mt-1">{note.note}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {timesheet.submission.status === 'SUBMITTED' && (
                  <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center gap-3">
                    <button
                      onClick={() => handleApprove(timesheet.submission.id)}
                      disabled={processingId !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Approve Timesheet
                    </button>
                    <button
                      onClick={() => handleRejectTimesheet(timesheet.submission.id)}
                      disabled={processingId !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      Reject Timesheet
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
