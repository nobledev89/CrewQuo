'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { X, Clock, DollarSign, BarChart3, Send, RotateCcw } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    projectId: string;
    projectName: string;
    clientId: string;
    clientName: string;
  };
  rateAssignment: {
    payRateCardId: string;
    billRateCardId: string;
  } | null;
  rateCards: Map<string, any>;
}

export default function ProjectModal({
  isOpen,
  onClose,
  project,
  rateAssignment,
  rateCards,
}: ProjectModalProps) {
  const [activeTab, setActiveTab] = useState<'logs' | 'expenses' | 'summary'>('logs');
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLog, setSavingLog] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'draft' | 'submitted' | 'approved'>('all');
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'draft' | 'submitted' | 'approved'>('all');
  const [showAddLogForm, setShowAddLogForm] = useState(false);
  const [showAddExpenseForm, setShowAddExpenseForm] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [logForm, setLogForm] = useState({
    date: '',
    rateKey: '',
    hoursRegular: 8,
    hoursOT: 0,
    notes: '',
  });

  const [expenseForm, setExpenseForm] = useState({
    date: '',
    expenseKey: '',
    amount: 0,
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchProjectData();
    }
  }, [isOpen, project.projectId]);

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const activeCompanyId = userData?.activeCompanyId || userData?.companyId;
      const subRole = userData?.subcontractorRoles?.[activeCompanyId];

      // Fetch time logs for this project
      const logsQuery = query(
        collection(db, 'timeLogs'),
        where('projectId', '==', project.projectId),
        where('subcontractorId', '==', subRole.subcontractorId),
        orderBy('date', 'desc')
      );
      const logsSnap = await getDocs(logsQuery);
      const logs = logsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setTimeLogs(logs);

      // Fetch expenses for this project
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('projectId', '==', project.projectId),
        where('subcontractorId', '==', subRole.subcontractorId),
        orderBy('date', 'desc')
      );
      const expensesSnap = await getDocs(expensesQuery);
      const exps = expensesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setExpenses(exps);
    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const payCard = rateAssignment?.payRateCardId
    ? rateCards.get(rateAssignment.payRateCardId)
    : undefined;
  const billCard = rateAssignment?.billRateCardId
    ? rateCards.get(rateAssignment.billRateCardId)
    : undefined;

  // Debug logging
  console.log('🔍 Debug Info:');
  console.log('- Rate Assignment:', rateAssignment);
  console.log('- Pay Rate Card ID:', rateAssignment?.payRateCardId);
  console.log('- Pay Card Object:', payCard);
  console.log('- Pay Card Rates Array:', payCard?.rates);
  console.log('- Number of rate options:', payCard?.rates?.length || 0);

  const rateOptions =
    payCard?.rates?.map((r: any, idx: number) => ({
      key: `${idx}`,
      label: `${r.roleName} - ${r.shiftType}`,
      value: r,
    })) || [];

  const selectedRateEntry =
    payCard?.rates && logForm.rateKey !== ''
      ? payCard.rates[parseInt(logForm.rateKey, 10)]
      : undefined;

  const matchingBillEntry =
    billCard?.rates?.find(
      (r: any) =>
        r.roleName === selectedRateEntry?.roleName &&
        r.shiftType === selectedRateEntry?.shiftType
    ) || undefined;

  const payRate = selectedRateEntry
    ? (selectedRateEntry.hourlyRate ?? selectedRateEntry.baseRate ?? 0)
    : 0;
  const billRate = matchingBillEntry
    ? (matchingBillEntry.hourlyRate ?? matchingBillEntry.baseRate ?? payRate)
    : payRate;

  const calculatedLog = {
    cost: payRate * (Number(logForm.hoursRegular) + Number(logForm.hoursOT)),
    bill: billRate * (Number(logForm.hoursRegular) + Number(logForm.hoursOT)),
  };
  calculatedLog.cost = Math.round(calculatedLog.cost * 100) / 100;
  calculatedLog.bill = Math.round(calculatedLog.bill * 100) / 100;

  const expenseOptions =
    payCard?.expenses?.map((e: any) => ({
      key: e.id,
      label: e.categoryName,
      rate: e.rate,
    })) || [];

  const selectedExpense = expenseOptions.find((e: any) => e.key === expenseForm.expenseKey);

  const saveLog = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!selectedRateEntry || !logForm.date) {
      alert('Please fill in all required fields');
      return;
    }

    setSavingLog(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const activeCompanyId = userData?.activeCompanyId || userData?.companyId;
      const subRole = userData?.subcontractorRoles?.[activeCompanyId];

      await addDoc(collection(db, 'timeLogs'), {
        companyId: activeCompanyId,
        projectId: project.projectId,
        clientId: project.clientId,
        subcontractorId: subRole.subcontractorId,
        createdByUserId: user.uid,
        date: new Date(logForm.date),
        roleName: selectedRateEntry.roleName,
        shiftType: selectedRateEntry.shiftType,
        hoursRegular: Number(logForm.hoursRegular),
        hoursOT: Number(logForm.hoursOT),
        subCost: calculatedLog.cost,
        clientBill: calculatedLog.bill,
        marginValue: calculatedLog.bill - calculatedLog.cost,
        marginPct:
          calculatedLog.bill > 0
            ? ((calculatedLog.bill - calculatedLog.cost) / calculatedLog.bill) * 100
            : 0,
        currency: 'GBP',
        payRateCardId: rateAssignment?.payRateCardId || null,
        billRateCardId: rateAssignment?.billRateCardId || null,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setLogForm({
        date: '',
        rateKey: '',
        hoursRegular: 8,
        hoursOT: 0,
        notes: '',
      });
      await fetchProjectData();
    } catch (error) {
      console.error('Error saving log:', error);
      alert('Failed to save time log');
    } finally {
      setSavingLog(false);
    }
  };

  const saveExpense = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!selectedExpense || !expenseForm.date) {
      alert('Please fill in all required fields');
      return;
    }

    const amount = Number(expenseForm.amount);
    if (amount > selectedExpense.rate) {
      alert('Amount cannot exceed rate cap');
      return;
    }

    setSavingExpense(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const activeCompanyId = userData?.activeCompanyId || userData?.companyId;
      const subRole = userData?.subcontractorRoles?.[activeCompanyId];

      await addDoc(collection(db, 'expenses'), {
        companyId: activeCompanyId,
        projectId: project.projectId,
        subcontractorId: subRole.subcontractorId,
        createdByUserId: user.uid,
        date: new Date(expenseForm.date),
        category: selectedExpense.label,
        amount,
        currency: 'GBP',
        payRateCardId: rateAssignment?.payRateCardId || null,
        billRateCardId: rateAssignment?.billRateCardId || null,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setExpenseForm({
        date: '',
        expenseKey: '',
        amount: 0,
        notes: '',
      });
      await fetchProjectData();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save expense');
    } finally {
      setSavingExpense(false);
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

  const getStatusBadge = (status: string) => {
    const styles = {
      DRAFT: 'bg-gray-100 text-gray-800 border-gray-200',
      SUBMITTED: 'bg-orange-100 text-orange-800 border-orange-200',
      APPROVED: 'bg-green-100 text-green-800 border-green-200',
      REJECTED: 'bg-red-100 text-red-800 border-red-200',
    };
    return styles[status as keyof typeof styles] || styles.DRAFT;
  };

  const filteredLogs = timeLogs.filter((log) => {
    if (logFilter === 'all') return true;
    return log.status?.toLowerCase() === logFilter;
  });

  const filteredExpenses = expenses.filter((exp) => {
    if (expenseFilter === 'all') return true;
    return exp.status?.toLowerCase() === expenseFilter;
  });

  // Calculate summary stats
  const summaryStats = {
    totalHours: timeLogs.reduce((sum, log) => sum + (log.hoursRegular || 0) + (log.hoursOT || 0), 0),
    totalEarnings: timeLogs.reduce((sum, log) => sum + (log.subCost || 0), 0),
    draftCount: timeLogs.filter((l) => l.status === 'DRAFT').length + expenses.filter((e) => e.status === 'DRAFT').length,
    submittedCount: timeLogs.filter((l) => l.status === 'SUBMITTED').length + expenses.filter((e) => e.status === 'SUBMITTED').length,
    approvedCount: timeLogs.filter((l) => l.status === 'APPROVED').length + expenses.filter((e) => e.status === 'APPROVED').length,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{project.projectName}</h2>
            <p className="text-sm text-gray-600 mt-1">Client: {project.clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition ${
              activeTab === 'logs'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Time Logs
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition ${
              activeTab === 'expenses'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <DollarSign className="w-4 h-4 inline mr-2" />
            Expenses
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition ${
              activeTab === 'summary'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Summary
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Time Logs Tab */}
              {activeTab === 'logs' && (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Form */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Add Time Log</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                      <input
                        type="date"
                        value={logForm.date}
                        onChange={(e) => setLogForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role & Shift *</label>
                      <select
                        value={logForm.rateKey}
                        onChange={(e) => setLogForm((p) => ({ ...p, rateKey: e.target.value }))}
                        disabled={rateOptions.length === 0}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          rateOptions.length === 0 
                            ? 'bg-gray-100 border-gray-300 cursor-not-allowed' 
                            : 'border-gray-300'
                        }`}
                      >
                        <option value="">
                          {rateOptions.length === 0 ? 'No shift types available' : 'Choose...'}
                        </option>
                        {rateOptions.map((o: any) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      
                      {/* Warning message when no rates available */}
                      {rateOptions.length === 0 && (
                        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-yellow-800 mb-1">
                                No Shift Types Available
                              </h4>
                              <p className="text-sm text-yellow-700 mb-2">
                                The assigned rate card has no rate entries configured. To add time logs, you need:
                              </p>
                              <ol className="text-sm text-yellow-700 list-decimal ml-4 space-y-1">
                                <li>A rate card assigned to this subcontractor for client "{project.clientName}"</li>
                                <li>The rate card must have at least one rate entry with a role name and shift type</li>
                              </ol>
                              <p className="text-sm text-yellow-700 mt-2">
                                Please contact your project administrator to add rate entries to your rate card.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Regular Hours</label>
                        <input
                          type="number"
                          step="0.5"
                          value={logForm.hoursRegular}
                          onChange={(e) => setLogForm((p) => ({ ...p, hoursRegular: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">OT Hours</label>
                        <input
                          type="number"
                          step="0.5"
                          value={logForm.hoursOT}
                          onChange={(e) => setLogForm((p) => ({ ...p, hoursOT: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {selectedRateEntry && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                        <p className="text-blue-900">Pay rate: £{payRate.toFixed(2)}/hr</p>
                        <p className="text-blue-900">Est. cost: £{calculatedLog.cost.toFixed(2)}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => saveLog('DRAFT')}
                        disabled={savingLog}
                        className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        Save Draft
                      </button>
                      <button
                        onClick={() => saveLog('SUBMITTED')}
                        disabled={savingLog}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Submit
                      </button>
                    </div>
                  </div>

                  {/* List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Time Log History</h3>
                      <select
                        value={logFilter}
                        onChange={(e) => setLogFilter(e.target.value as any)}
                        className="text-sm px-3 py-1 border border-gray-300 rounded-lg"
                      >
                        <option value="all">All</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="approved">Approved</option>
                      </select>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredLogs.length === 0 ? (
                        <p className="text-gray-500 text-sm">No time logs found</p>
                      ) : (
                        filteredLogs.map((log) => (
                          <div key={log.id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-900">
                                {log.roleName} - {log.shiftType}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded-full border ${getStatusBadge(log.status)}`}>
                                {log.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">{formatDate(log.date)}</p>
                            <p className="text-sm text-gray-700 mt-1">
                              {log.hoursRegular}h + {log.hoursOT}h OT = £{(log.subCost || 0).toFixed(2)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Expenses Tab */}
              {activeTab === 'expenses' && (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Form */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Add Expense</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Expense Type *</label>
                      <select
                        value={expenseForm.expenseKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          const selected = expenseOptions.find((opt: any) => opt.key === key);
                          setExpenseForm((p) => ({
                            ...p,
                            expenseKey: key,
                            amount: selected ? selected.rate : 0,
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Choose...</option>
                        {expenseOptions.map((o: any) => (
                          <option key={o.key} value={o.key}>
                            {o.label} (cap £{o.rate.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => saveExpense('DRAFT')}
                        disabled={savingExpense}
                        className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        Save Draft
                      </button>
                      <button
                        onClick={() => saveExpense('SUBMITTED')}
                        disabled={savingExpense}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Submit
                      </button>
                    </div>
                  </div>

                  {/* List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Expense History</h3>
                      <select
                        value={expenseFilter}
                        onChange={(e) => setExpenseFilter(e.target.value as any)}
                        className="text-sm px-3 py-1 border border-gray-300 rounded-lg"
                      >
                        <option value="all">All</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="approved">Approved</option>
                      </select>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredExpenses.length === 0 ? (
                        <p className="text-gray-500 text-sm">No expenses found</p>
                      ) : (
                        filteredExpenses.map((exp) => (
                          <div key={exp.id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-900">{exp.category}</span>
                              <span className={`px-2 py-1 text-xs rounded-full border ${getStatusBadge(exp.status)}`}>
                                {exp.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">{formatDate(exp.date)}</p>
                            <p className="text-sm text-gray-700 mt-1">£{(exp.amount || 0).toFixed(2)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Project Summary</h3>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-600 mb-1">Total Hours</p>
                      <p className="text-3xl font-bold text-blue-900">{summaryStats.totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-600 mb-1">Total Earnings</p>
                      <p className="text-3xl font-bold text-green-900">£{summaryStats.totalEarnings.toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm text-purple-600 mb-1">Total Entries</p>
                      <p className="text-3xl font-bold text-purple-900">{timeLogs.length + expenses.length}</p>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Status Breakdown</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Draft</span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                          {summaryStats.draftCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Submitted</span>
                        <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
                          {summaryStats.submittedCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Approved</span>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                          {summaryStats.approvedCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
