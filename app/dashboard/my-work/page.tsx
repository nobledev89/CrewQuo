'use client';

import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
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
import DashboardLayout from '@/components/DashboardLayout';
import { Briefcase, ClipboardList, Clock, DollarSign, Send, RotateCcw } from 'lucide-react';

interface Assignment {
  id: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
}

interface RateEntry {
  roleName: string;
  shiftType: string;
  hourlyRate-: number | null;
  baseRate: number;
}

interface ExpenseEntry {
  id: string;
  categoryId: string;
  categoryName: string;
  rate: number;
}

interface RateCard {
  id: string;
  name: string;
  cardType-: 'PAY' | 'BILL';
  rates-: RateEntry[];
  expenses-: ExpenseEntry[];
}

interface RateAssignment {
  clientId: string;
  payRateCardId-: string;
  billRateCardId-: string;
}

interface TimeLog {
  id: string;
  projectId: string;
  projectName: string;
  clientId-: string;
  roleName: string;
  shiftType: string;
  date: any;
  hoursRegular: number;
  hoursOT: number;
  subCost: number;
  clientBill: number;
  marginValue: number;
  marginPct: number;
  status: string;
}

interface Expense {
  id: string;
  projectId: string;
  projectName: string;
  category: string;
  amount: number;
  status: string;
  date: any;
}

export default function MyWorkPage() {
  const [loading, setLoading] = useState(true);
  const [savingLog, setSavingLog] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [subcontractorId, setSubcontractorId] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [rateAssignments, setRateAssignments] = useState<Map<string, RateAssignment>>(new Map());
  const [rateCards, setRateCards] = useState<Map<string, RateCard>>(new Map());
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [logForm, setLogForm] = useState({
    projectId: '',
    date: '',
    rateKey: '',
    hoursRegular: 8,
    hoursOT: 0,
    notes: '',
  });

  const [expenseForm, setExpenseForm] = useState({
    projectId: '',
    date: '',
    expenseKey: '',
    amount: 0,
    notes: '',
  });

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

        const subRole = userData.subcontractorRoles-.[activeId];
        if (!subRole) {
          setLoading(false);
          return;
        }
        setSubcontractorId(subRole.subcontractorId);

        await fetchAssignments(activeId, subRole.subcontractorId);
        await fetchRateAssignments(activeId, subRole.subcontractorId);
        await fetchTimeLogs(activeId, subRole.subcontractorId, currentUser.uid);
        await fetchExpenses(activeId, subRole.subcontractorId, currentUser.uid);
      } catch (err) {
        console.error('Error loading subcontractor workspace', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const fetchAssignments = async (companyId: string, subId: string) => {
    const assignmentsSnap = await getDocs(
      query(
        collection(db, 'projectAssignments'),
        where('companyId', '==', companyId),
        where('subcontractorId', '==', subId)
      )
    );

    const projects: Assignment[] = [];
    for (const a of assignmentsSnap.docs) {
      const data = a.data();
      const projDoc = await getDoc(doc(db, 'projects', data.projectId));
      if (!projDoc.exists()) continue;
      const project = projDoc.data();
      let clientName = 'Unknown client';
      if (project.clientId) {
        const clientDoc = await getDoc(doc(db, 'clients', project.clientId));
        if (clientDoc.exists()) clientName = clientDoc.data().name;
      }
      projects.push({
        id: a.id,
        projectId: data.projectId,
        projectName: project.name,
        clientId: project.clientId,
        clientName,
      });
    }
    setAssignments(projects);
    if (projects.length > 0) {
      setLogForm((prev) => ({ ...prev, projectId: projects[0].projectId }));
      setExpenseForm((prev) => ({ ...prev, projectId: projects[0].projectId }));
    }
  };

  const fetchRateAssignments = async (companyId: string, subId: string) => {
    const snap = await getDocs(
      query(
        collection(db, 'subcontractorRateAssignments'),
        where('companyId', '==', companyId),
        where('subcontractorId', '==', subId)
      )
    );

    const map = new Map<string, RateAssignment>();
    const rateCardIds = new Set<string>();

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const ra: RateAssignment = {
        clientId: data.clientId,
        payRateCardId: data.payRateCardId || data.rateCardId,
        billRateCardId: data.billRateCardId,
      };
      if (ra.payRateCardId) rateCardIds.add(ra.payRateCardId);
      if (ra.billRateCardId) rateCardIds.add(ra.billRateCardId);
      map.set(data.clientId, ra);
    });

    // fetch rate cards referenced
    const cardsMap = new Map<string, RateCard>();
    for (const id of rateCardIds) {
      const cardDoc = await getDoc(doc(db, 'rateCards', id));
      if (cardDoc.exists()) {
        cardsMap.set(id, { id, ...cardDoc.data() } as RateCard);
      }
    }

    setRateAssignments(map);
    setRateCards(cardsMap);
  };

  const fetchTimeLogs = async (companyId: string, subId: string, uid: string) => {
    const snap = await getDocs(
      query(
        collection(db, 'timeLogs'),
        where('companyId', '==', companyId),
        where('subcontractorId', '==', subId),
        where('createdByUserId', '==', uid),
        orderBy('date', 'desc')
      )
    );
    const logs: TimeLog[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      let projectName = 'Unknown project';
      if (data.projectId) {
        const projDoc = await getDoc(doc(db, 'projects', data.projectId));
        if (projDoc.exists()) projectName = projDoc.data().name;
      }
      logs.push({
        id: d.id,
        projectId: data.projectId,
        projectName,
        clientId: data.clientId,
        roleName: data.roleName || data.roleId || 'Role',
        shiftType: data.shiftType || 'Shift',
        date: data.date,
        hoursRegular: data.hoursRegular || 0,
        hoursOT: data.hoursOT || 0,
        subCost: data.subCost || 0,
        clientBill: data.clientBill || 0,
        marginValue: data.marginValue || 0,
        marginPct: data.marginPct || 0,
        status: data.status || 'DRAFT',
      });
    }
    setTimeLogs(logs);
  };

  const fetchExpenses = async (companyId: string, subId: string, uid: string) => {
    const snap = await getDocs(
      query(
        collection(db, 'expenses'),
        where('companyId', '==', companyId),
        where('subcontractorId', '==', subId),
        where('createdByUserId', '==', uid),
        orderBy('date', 'desc')
      )
    );
    const exps: Expense[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      let projectName = 'Unknown project';
      if (data.projectId) {
        const projDoc = await getDoc(doc(db, 'projects', data.projectId));
        if (projDoc.exists()) projectName = projDoc.data().name;
      }
      exps.push({
        id: d.id,
        projectId: data.projectId,
        projectName,
        category: data.category || data.categoryName || 'Expense',
        amount: data.amount || 0,
        status: data.status || 'DRAFT',
        date: data.date,
      });
    }
    setExpenses(exps);
  };

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.projectId === logForm.projectId),
    [assignments, logForm.projectId]
  );

  const selectedExpenseAssignment = useMemo(
    () => assignments.find((a) => a.projectId === expenseForm.projectId),
    [assignments, expenseForm.projectId]
  );

  const currentRateAssignment = useMemo(() => {
    if (!selectedAssignment) return null;
    return rateAssignments.get(selectedAssignment.clientId);
  }, [selectedAssignment, rateAssignments]);

  const currentExpenseRateAssignment = useMemo(() => {
    if (!selectedExpenseAssignment) return null;
    return rateAssignments.get(selectedExpenseAssignment.clientId);
  }, [selectedExpenseAssignment, rateAssignments]);

  const payCard = currentRateAssignment-.payRateCardId
    - rateCards.get(currentRateAssignment.payRateCardId)
    : undefined;
  const billCard = currentRateAssignment-.billRateCardId
    - rateCards.get(currentRateAssignment.billRateCardId)
    : undefined;

  const rateOptions =
    payCard-.rates-.map((r, idx) => ({
      key: `${idx}`,
      label: `${r.roleName} - ${r.shiftType}`,
      value: r,
    })) || [];

  const selectedRateEntry =
    payCard-.rates && logForm.rateKey !== ''
      - payCard.rates[parseInt(logForm.rateKey, 10)]
      : undefined;

  const matchingBillEntry =
    billCard-.rates-.find(
      (r) =>
        r.roleName === selectedRateEntry-.roleName &&
        r.shiftType === selectedRateEntry-.shiftType
    ) || undefined;

  const payRate = selectedRateEntry
    - (selectedRateEntry.hourlyRate -- selectedRateEntry.baseRate -- 0)
    : 0;
  const billRate = matchingBillEntry
    - (matchingBillEntry.hourlyRate -- matchingBillEntry.baseRate -- payRate)
    : payRate;

  const calculatedLog = useMemo(() => {
    const regular = Number(logForm.hoursRegular) || 0;
    const ot = Number(logForm.hoursOT) || 0;
    const cost = payRate * (regular + ot);
    const bill = billRate * (regular + ot);
    const marginValue = bill - cost;
    const marginPct = bill > 0 - (marginValue / bill) * 100 : 0;
    return {
      cost: Math.round(cost * 100) / 100,
      bill: Math.round(bill * 100) / 100,
      marginValue: Math.round(marginValue * 100) / 100,
      marginPct: Math.round(marginPct * 100) / 100,
    };
  }, [payRate, billRate, logForm.hoursRegular, logForm.hoursOT]);

  const expenseOptions =
    (currentExpenseRateAssignment-.payRateCardId
      - rateCards.get(currentExpenseRateAssignment.payRateCardId)-.expenses
      : payCard-.expenses)-.map((e) => ({
      key: e.id,
      label: e.categoryName,
      rate: e.rate,
    })) || [];

  const selectedExpense = expenseOptions.find((e) => e.key === expenseForm.expenseKey);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate - timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateInput = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate - timestamp.toDate() : new Date(timestamp);
    return date.toISOString().slice(0, 10);
  };

  const resetLogForm = () => {
    setEditingLogId(null);
    setLogForm((prev) => ({
      projectId: prev.projectId || assignments[0]-.projectId || '',
      date: '',
      rateKey: '',
      hoursRegular: 8,
      hoursOT: 0,
      notes: '',
    }));
  };

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseForm((prev) => ({
      projectId: prev.projectId || assignments[0]-.projectId || '',
      date: '',
      expenseKey: '',
      amount: 0,
      notes: '',
    }));
  };

  const saveLog = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!selectedAssignment || !selectedRateEntry) {
      alert('Please choose a project and rate.');
      return;
    }
    if (!logForm.date) {
      alert('Select a date');
      return;
    }
    setSavingLog(true);
    try {
      const basePayload = {
        companyId: activeCompanyId,
        projectId: selectedAssignment.projectId,
        clientId: selectedAssignment.clientId,
        subcontractorId,
        createdByUserId: auth.currentUser-.uid,
        date: new Date(logForm.date),
        roleName: selectedRateEntry.roleName,
        shiftType: selectedRateEntry.shiftType,
        hoursRegular: Number(logForm.hoursRegular) || 0,
        hoursOT: Number(logForm.hoursOT) || 0,
        subCost: calculatedLog.cost,
        clientBill: calculatedLog.bill,
        marginValue: calculatedLog.marginValue,
        marginPct: calculatedLog.marginPct,
        currency: 'GBP',
        payRateCardId: currentRateAssignment-.payRateCardId || null,
        billRateCardId: currentRateAssignment-.billRateCardId || null,
        updatedAt: serverTimestamp(),
      };

      if (editingLogId) {
        await updateDoc(doc(db, 'timeLogs', editingLogId), {
          ...basePayload,
          status: status === 'SUBMITTED' - 'SUBMITTED' : 'DRAFT',
        });
      } else {
        const logRef = await addDoc(collection(db, 'timeLogs'), {
          ...basePayload,
          createdAt: serverTimestamp(),
          status: 'DRAFT',
        });

        if (status === 'SUBMITTED') {
          await updateDoc(logRef, { status: 'SUBMITTED', updatedAt: serverTimestamp() });
        }
      }

      await fetchTimeLogs(activeCompanyId, subcontractorId, auth.currentUser!.uid);
      resetLogForm();
    } catch (err) {
      console.error('Error saving log', err);
      alert('Failed to save log. Please try again.');
    } finally {
      setSavingLog(false);
    }
  };

  const saveExpense = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!expenseForm.projectId) {
      alert('Choose a project');
      return;
    }
    if (!expenseForm.date) {
      alert('Choose a date');
      return;
    }
    if (!selectedExpense) {
      alert('Choose an expense category');
      return;
    }
    const amount = Number(expenseForm.amount) || 0;
    if (amount > selectedExpense.rate) {
      alert('Amount cannot exceed rate cap');
      return;
    }
    setSavingExpense(true);
    try {
      const basePayload = {
        companyId: activeCompanyId,
        projectId: expenseForm.projectId,
        subcontractorId,
        createdByUserId: auth.currentUser-.uid,
        date: new Date(expenseForm.date),
        category: selectedExpense.label,
        amount,
        currency: 'GBP',
        payRateCardId: currentExpenseRateAssignment-.payRateCardId || null,
        billRateCardId: currentExpenseRateAssignment-.billRateCardId || null,
        updatedAt: serverTimestamp(),
      };

      if (editingExpenseId) {
        await updateDoc(doc(db, 'expenses', editingExpenseId), {
          ...basePayload,
          status: status === 'SUBMITTED' - 'SUBMITTED' : 'DRAFT',
        });
      } else {
        const expRef = await addDoc(collection(db, 'expenses'), {
          ...basePayload,
          createdAt: serverTimestamp(),
          status: 'DRAFT',
        });
        if (status === 'SUBMITTED') {
          await updateDoc(expRef, { status: 'SUBMITTED', updatedAt: serverTimestamp() });
        }
      }

      await fetchExpenses(activeCompanyId, subcontractorId, auth.currentUser!.uid);
      resetExpenseForm();
    } catch (err) {
      console.error('Error saving expense', err);
      alert('Failed to save expense. Please try again.');
    } finally {
      setSavingExpense(false);
    }
  };

  const loadLogForEdit = (log: TimeLog) => {
    setEditingLogId(log.id);
    setLogForm({
      projectId: log.projectId,
      date: formatDateInput(log.date),
      rateKey: '',
      hoursRegular: log.hoursRegular,
      hoursOT: log.hoursOT,
      notes: '',
    });
  };

  const loadExpenseForEdit = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setExpenseForm({
      projectId: exp.projectId,
      date: formatDateInput(exp.date),
      expenseKey: '',
      amount: exp.amount,
      notes: '',
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your workspace...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (userRole !== 'SUBCONTRACTOR') {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="font-semibold text-yellow-800">This view is for subcontractors.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Work</h1>
            <p className="text-gray-600">Projects assigned to you and your rate cards</p>
          </div>
        </div>

        {/* Assignments */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Briefcase className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Assigned Projects</h2>
          </div>
          {assignments.length === 0 - (
            <p className="text-gray-600">No assignments yet.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {assignments.map((a) => (
                <div key={a.projectId} className="border border-gray-200 rounded-lg p-3">
                  <p className="font-semibold text-gray-900">{a.projectName}</p>
                  <p className="text-sm text-gray-600">Client: {a.clientName}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Time Logs */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4" id="logs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Time Logs</h2>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Project *</label>
              <select
                value={logForm.projectId}
                onChange={(e) => setLogForm((p) => ({ ...p, projectId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {assignments.map((a) => (
                  <option key={a.projectId} value={a.projectId}>
                    {a.projectName} ({a.clientName})
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-gray-700">Date *</label>
              <input
                type="date"
                value={logForm.date}
                onChange={(e) => setLogForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <label className="block text-sm font-medium text-gray-700">Role & Shift *</label>
              <select
                value={logForm.rateKey}
                onChange={(e) => setLogForm((p) => ({ ...p, rateKey: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose...</option>
                {rateOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Regular Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={logForm.hoursRegular}
                    onChange={(e) => setLogForm((p) => ({ ...p, hoursRegular: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">OT Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={logForm.hoursOT}
                    onChange={(e) => setLogForm((p) => ({ ...p, hoursOT: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {selectedRateEntry ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                  <p>Pay rate: GBP {payRate.toFixed(2)} / hr</p>
                  <p>Bill rate: GBP {billRate.toFixed(2)} / hr</p>
                  <p>
                    Est. cost GBP {calculatedLog.cost.toFixed(2)} - Bill GBP {calculatedLog.bill.toFixed(2)} - Margin{' '}
                    {calculatedLog.marginPct.toFixed(1)}%
                  </p>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  Choose a project with an assigned pay rate card to enter a log.
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveLog('DRAFT')}
                  disabled={savingLog}
                  className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 disabled:bg-gray-200"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => saveLog('SUBMITTED')}
                  disabled={savingLog}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Submit
                </button>
                {editingLogId && (
                  <button
                    onClick={resetLogForm}
                    className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Cancel edit
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {timeLogs.length === 0 ? (
                <p className="text-gray-600">No logs yet.</p>
              ) : (
                timeLogs.map((log) => (
                  <div key={log.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{log.projectName}</p>
                        <p className="text-sm text-gray-600">
                          {log.roleName} - {log.shiftType}
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(log.date)}</p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          log.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : log.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 mt-2">
                      GBP {log.subCost.toFixed(2)} cost - GBP {log.clientBill.toFixed(2)} bill
                    </div>
                    {log.status === 'DRAFT' || log.status === 'REJECTED' ? (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => loadLogForEdit(log)}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => updateDoc(doc(db, 'timeLogs', log.id), { status: 'SUBMITTED', updatedAt: serverTimestamp() })}
                          className="text-green-600 text-sm hover:underline"
                        >
                          Submit
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4" id="expenses">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Expenses</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Project *</label>
              <select
                value={expenseForm.projectId}
                onChange={(e) => setExpenseForm((p) => ({ ...p, projectId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {assignments.map((a) => (
                  <option key={a.projectId} value={a.projectId}>
                    {a.projectName} ({a.clientName})
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-gray-700">Date *</label>
              <input
                type="date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <label className="block text-sm font-medium text-gray-700">Expense Type *</label>
              <select
                value={expenseForm.expenseKey}
                onChange={(e) => {
                  const key = e.target.value;
                  const selected = expenseOptions.find((opt) => opt.key === key);
                  setExpenseForm((p) => ({
                    ...p,
                    expenseKey: key,
                    amount: selected ? selected.rate : 0,
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose...</option>
                {expenseOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label} (cap GBP {o.rate.toFixed(2)})
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-gray-700">Amount (capped)</label>
              <input
                type="number"
                step="0.01"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveExpense('DRAFT')}
                  disabled={savingExpense}
                  className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 disabled:bg-gray-200"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => saveExpense('SUBMITTED')}
                  disabled={savingExpense}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Submit
                </button>
                {editingExpenseId && (
                  <button
                    onClick={resetExpenseForm}
                    className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Cancel edit
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {expenses.length === 0 ? (
                <p className="text-gray-600">No expenses yet.</p>
              ) : (
                expenses.map((exp) => (
                  <div key={exp.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{exp.projectName}</p>
                        <p className="text-sm text-gray-600">{exp.category}</p>
                        <p className="text-xs text-gray-500">{formatDate(exp.date)}</p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          exp.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : exp.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {exp.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 mt-2">GBP {exp.amount.toFixed(2)}</div>
                    {exp.status === 'DRAFT' || exp.status === 'REJECTED' ? (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => loadExpenseForEdit(exp)}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            updateDoc(doc(db, 'expenses', exp.id), {
                              status: 'SUBMITTED',
                              updatedAt: serverTimestamp(),
                            })
                          }
                          className="text-green-600 text-sm hover:underline"
                        >
                          Submit
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
