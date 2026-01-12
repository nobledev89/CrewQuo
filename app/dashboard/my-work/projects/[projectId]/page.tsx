'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  deleteDoc,
  serverTimestamp,
  orderBy,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DashboardLayout from '@/components/DashboardLayout';
import { ArrowLeft, Clock, DollarSign, BarChart3, Send, Plus, Edit2, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { calculateTimeBasedCost } from '@/lib/timeBasedRateCalculator';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string | undefined;

  // Project data
  const [project, setProject] = useState<any>(null);
  const [clientName, setClientName] = useState<string>('');
  const [rateAssignment, setRateAssignment] = useState<any>(null);
  const [rateCards, setRateCards] = useState<Map<string, any>>(new Map());

  // Tab state
  const [activeTab, setActiveTab] = useState<'logs' | 'expenses' | 'summary'>('logs');

  // Data state
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLog, setSavingLog] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [logFilter, setLogFilter] = useState<'all'>('all');
  const [expenseFilter, setExpenseFilter] = useState<'all'>('all');
  const [submittingTimesheet, setSubmittingTimesheet] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Form state - Always use time picker for subcontractors
  const [useTimePicker, setUseTimePicker] = useState(true);
  const [logForm, setLogForm] = useState({
    date: '',
    rateKey: '',
    startTime: '08:00',
    endTime: '17:00',
    hoursRegular: 8,
    quantity: 1,
    notes: '',
  });

  const [expenseForm, setExpenseForm] = useState({
    date: '',
    expenseKey: '',
    quantity: 1,
    amount: 0,
    notes: '',
  });

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await fetchProjectData(currentUser);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [projectId]);

  const fetchProjectData = async (currentUser: any) => {
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      const activeCompanyId = userData?.activeCompanyId || userData?.companyId;
      const subRole = userData?.subcontractorRoles?.[activeCompanyId];

      if (!subRole) {
        setError('You do not have access to this project');
        setLoading(false);
        return;
      }

      // Fetch project details
      const projectDoc = await getDoc(doc(db, 'projects', projectId!));
      if (!projectDoc.exists()) {
        setError('Project not found');
        setLoading(false);
        return;
      }

      const projectData = projectDoc.data();
      setProject({ id: projectDoc.id, ...projectData });

      // Fetch client name
      if (projectData.clientId) {
        const clientDoc = await getDoc(doc(db, 'clients', projectData.clientId));
        if (clientDoc.exists()) {
          setClientName(clientDoc.data().name);
        }
      }

      // Fetch rate assignments
      const rateAssignmentsQuery = query(
        collection(db, 'subcontractorRateAssignments'),
        where('companyId', '==', activeCompanyId),
        where('subcontractorId', '==', subRole.subcontractorId),
        where('clientId', '==', projectData.clientId)
      );
      const rateAssignmentsSnap = await getDocs(rateAssignmentsQuery);

      if (!rateAssignmentsSnap.empty) {
        const rateData = rateAssignmentsSnap.docs[0].data();
        setRateAssignment({
          payRateCardId: rateData.payRateCardId || rateData.rateCardId,
          billRateCardId: rateData.billRateCardId,
        });

        // Fetch rate cards
        const cardsMap = new Map<string, any>();
        const cardIds = [rateData.payRateCardId || rateData.rateCardId, rateData.billRateCardId].filter(Boolean);

        for (const cardId of cardIds) {
          const cardDoc = await getDoc(doc(db, 'rateCards', cardId));
          if (cardDoc.exists()) {
            cardsMap.set(cardId, { id: cardDoc.id, ...cardDoc.data() });
          }
        }
        setRateCards(cardsMap);
      }

      // Fetch time logs
      const logsQuery = query(
        collection(db, 'timeLogs'),
        where('companyId', '==', activeCompanyId),
        where('projectId', '==', projectId),
        where('subcontractorId', '==', subRole.subcontractorId),
        orderBy('date', 'desc')
      );
      const logsSnap = await getDocs(logsQuery);
      const logs = logsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || null),
        };
      });
      setTimeLogs(logs);

      // Fetch expenses
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('companyId', '==', activeCompanyId),
        where('projectId', '==', projectId),
        where('subcontractorId', '==', subRole.subcontractorId),
        orderBy('date', 'desc')
      );
      const expensesSnap = await getDocs(expensesQuery);
      const exps = expensesSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || null),
        };
      });
      setExpenses(exps);

    } catch (error) {
      console.error('Error fetching project data:', error);
      setError('Failed to load project data');
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

  // Group rates by role name only (not role + shift)
  const rateOptions = useMemo(() => {
    if (!payCard?.rates) return [];
    
    const uniqueRoles = new Map<string, any[]>();
    payCard.rates.forEach((r: any) => {
      if (!uniqueRoles.has(r.roleName)) {
        uniqueRoles.set(r.roleName, []);
      }
      uniqueRoles.get(r.roleName)!.push(r);
    });
    
    return Array.from(uniqueRoles.entries()).map(([roleName, rateEntries]) => ({
      key: roleName,
      label: roleName,
      rateEntries, // All shift variations for this role
    }));
  }, [payCard]);

  // Get all rate entries for the selected role (all shifts)
  const selectedRoleEntries = useMemo(() => {
    const selected = rateOptions.find(opt => opt.key === logForm.rateKey);
    return selected?.rateEntries || [];
  }, [rateOptions, logForm.rateKey]);

  // For backward compatibility, use the first entry as the primary
  const selectedRateEntry = selectedRoleEntries[0];

  const matchingBillEntry =
    billCard?.rates?.find(
      (r: any) => {
        const roleMatch = r.roleName === selectedRateEntry?.roleName;
        const timeframeMatch = selectedRateEntry?.timeframeId
          ? r.timeframeId === selectedRateEntry.timeframeId
          : r.shiftType === selectedRateEntry?.shiftType;
        return roleMatch && timeframeMatch;
      }
    ) || undefined;

  const payRate = selectedRateEntry
    ? (selectedRateEntry.subcontractorRate ?? selectedRateEntry.hourlyRate ?? selectedRateEntry.baseRate ?? 0)
    : 0;
  const billRate = matchingBillEntry
    ? (matchingBillEntry.clientRate ?? matchingBillEntry.hourlyRate ?? matchingBillEntry.baseRate ?? payRate)
    : (selectedRateEntry?.clientRate ?? payRate);

  // Calculate cost using useMemo to avoid infinite re-renders
  const { calculatedLog, calculationBreakdown } = useMemo(() => {
    let log = { cost: 0, bill: 0, hours: 0 };
    let breakdown: any[] = [];

    if (useTimePicker && logForm.startTime && logForm.endTime && selectedRateEntry) {
      const timeBasedRates = selectedRateEntry.timeBasedRates;

      if (timeBasedRates && timeBasedRates.length > 0) {
        const result = calculateTimeBasedCost(
          logForm.startTime,
          logForm.endTime,
          timeBasedRates,
          payRate,
          billRate
        );

        log.hours = result.totalHours;
        log.cost = result.subcontractorCost * Number(logForm.quantity);
        log.bill = result.clientBill * Number(logForm.quantity);
        breakdown = result.breakdown;
      } else {
        const startMinutes = parseInt(logForm.startTime.split(':')[0]) * 60 + parseInt(logForm.startTime.split(':')[1]);
        let endMinutes = parseInt(logForm.endTime.split(':')[0]) * 60 + parseInt(logForm.endTime.split(':')[1]);

        if (endMinutes <= startMinutes) {
          endMinutes += 24 * 60;
        }

        const hours = (endMinutes - startMinutes) / 60;
        log.hours = Math.round(hours * 100) / 100;
        log.cost = payRate * hours * Number(logForm.quantity);
        log.bill = billRate * hours * Number(logForm.quantity);
      }
    } else {
      log.hours = Number(logForm.hoursRegular);
      log.cost = payRate * log.hours * Number(logForm.quantity);
      log.bill = billRate * log.hours * Number(logForm.quantity);
    }

    log.cost = Math.round(log.cost * 100) / 100;
    log.bill = Math.round(log.bill * 100) / 100;

    return { calculatedLog: log, calculationBreakdown: breakdown };
  }, [useTimePicker, logForm.startTime, logForm.endTime, logForm.hoursRegular, logForm.quantity, selectedRateEntry, payRate, billRate]);

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

      // If we have multiple rate segments (time-based rates), create separate entries for each
      if (calculationBreakdown.length > 1) {
        // Create separate time log entry for each rate segment
        for (const segment of calculationBreakdown) {
          // Extract start and end times from the segment time range
          const timeRangeMatch = segment.timeRange.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
          const segmentStartTime = timeRangeMatch ? timeRangeMatch[1] : logForm.startTime;
          const segmentEndTime = timeRangeMatch ? timeRangeMatch[2] : logForm.endTime;
          
          const segmentCost = segment.subCost * Number(logForm.quantity);
          const segmentBill = segment.clientCost * Number(logForm.quantity);

          const timeLogData: any = {
            companyId: activeCompanyId,
            projectId: projectId,
            clientId: project.clientId,
            subcontractorId: subRole.subcontractorId,
            createdByUserId: user.uid,
            date: new Date(logForm.date),
            roleName: selectedRateEntry.roleName,
            hoursRegular: segment.hours,
            hoursOT: 0,
            quantity: Number(logForm.quantity),
            subCost: segmentCost,
            clientBill: segmentBill,
            marginValue: segmentBill - segmentCost,
            marginPct:
              segmentBill > 0
                ? ((segmentBill - segmentCost) / segmentBill) * 100
                : 0,
            unitSubCost: segment.subRate,
            unitClientBill: segment.clientRate,
            currency: 'GBP',
            payRateCardId: rateAssignment?.payRateCardId || null,
            billRateCardId: rateAssignment?.billRateCardId || null,
            status,
            startTime: segmentStartTime,
            endTime: segmentEndTime,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          // Try to determine shift type from segment description
          const description = segment.timeRange.split('(')[1]?.split(')')[0] || 'Standard';
          timeLogData.shiftType = description;

          await addDoc(collection(db, 'timeLogs'), timeLogData);
        }

        setSuccess(`${calculationBreakdown.length} time log entries created (split by shift)`);
      } else {
        // Single entry (no split needed)
        const timeLogData: any = {
          companyId: activeCompanyId,
          projectId: projectId,
          clientId: project.clientId,
          subcontractorId: subRole.subcontractorId,
          createdByUserId: user.uid,
          date: new Date(logForm.date),
          roleName: selectedRateEntry.roleName,
          hoursRegular: calculatedLog.hours,
          hoursOT: 0,
          quantity: Number(logForm.quantity),
          subCost: calculatedLog.cost,
          clientBill: calculatedLog.bill,
          marginValue: calculatedLog.bill - calculatedLog.cost,
          marginPct:
            calculatedLog.bill > 0
              ? ((calculatedLog.bill - calculatedLog.cost) / calculatedLog.bill) * 100
              : 0,
          unitSubCost: payRate,
          unitClientBill: billRate,
          currency: 'GBP',
          payRateCardId: rateAssignment?.payRateCardId || null,
          billRateCardId: rateAssignment?.billRateCardId || null,
          status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // Store start and end times for time picker tracking
        if (useTimePicker && logForm.startTime && logForm.endTime) {
          timeLogData.startTime = logForm.startTime;
          timeLogData.endTime = logForm.endTime;
        }

        if (selectedRateEntry.timeframeId && selectedRateEntry.timeframeName) {
          timeLogData.timeframeId = selectedRateEntry.timeframeId;
          timeLogData.timeframeName = selectedRateEntry.timeframeName;
        } else if (selectedRateEntry.shiftType) {
          timeLogData.shiftType = selectedRateEntry.shiftType;
        }

        await addDoc(collection(db, 'timeLogs'), timeLogData);
        setSuccess('Time log added successfully');
      }

      setLogForm({
        date: '',
        rateKey: '',
        startTime: '',
        endTime: '',
        hoursRegular: 8,
        quantity: 1,
        notes: '',
      });

      if (auth.currentUser) {
        await fetchProjectData(auth.currentUser);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving log:', error);
      alert('Failed to save time log');
    } finally {
      setSavingLog(false);
    }
  };

  const deleteTimeLog = async (logId: string) => {
    if (!window.confirm('Are you sure you want to delete this time log? This action cannot be undone.')) {
      return;
    }

    setDeletingId(logId);
    try {
      await deleteDoc(doc(db, 'timeLogs', logId));
      setSuccess('Time log deleted successfully');
      if (auth.currentUser) {
        await fetchProjectData(auth.currentUser);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting time log:', error);
      setError('Failed to delete time log');
      setTimeout(() => setError(''), 3000);
    } finally {
      setDeletingId(null);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
      return;
    }

    setDeletingId(expenseId);
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
      setSuccess('Expense deleted successfully');
      if (auth.currentUser) {
        await fetchProjectData(auth.currentUser);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting expense:', error);
      setError('Failed to delete expense');
      setTimeout(() => setError(''), 3000);
    } finally {
      setDeletingId(null);
    }
  };

  const saveExpense = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!selectedExpense || !expenseForm.date) {
      alert('Please fill in all required fields');
      return;
    }

    const calculatedAmount = expenseForm.quantity * selectedExpense.rate;
    if (calculatedAmount > selectedExpense.rate) {
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
        projectId: projectId,
        subcontractorId: subRole.subcontractorId,
        createdByUserId: user.uid,
        date: new Date(expenseForm.date),
        category: selectedExpense.label,
        amount: calculatedAmount,
        quantity: expenseForm.quantity,
        unitRate: selectedExpense.rate,
        unitType: 'per_unit',
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
        quantity: 1,
        amount: 0,
        notes: '',
      });

      if (auth.currentUser) {
        await fetchProjectData(auth.currentUser);
      }
      setSuccess('Expense added successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';

    try {
      let date: Date;
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else {
        return 'Invalid Date';
      }

      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      const day = String(date.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const year = date.getFullYear();

      return `${day} ${month} ${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const filteredLogs = timeLogs.filter((log) => {
    if (logFilter === 'all') return true;
    return log.status?.toLowerCase() === logFilter;
  });

  const filteredExpenses = expenses.filter((exp) => {
    if (expenseFilter === 'all') return true;
    return exp.status?.toLowerCase() === expenseFilter;
  });

  const summaryStats = {
    totalHours: timeLogs.reduce((sum, log) => sum + (log.hoursRegular || 0) + (log.hoursOT || 0), 0),
    totalEarnings: timeLogs.reduce((sum, log) => sum + (log.subCost || 0), 0) + expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0),
    draftCount: timeLogs.filter((l) => l.status === 'DRAFT').length + expenses.filter((e) => e.status === 'DRAFT').length,
    submittedCount: timeLogs.filter((l) => l.status === 'SUBMITTED').length + expenses.filter((e) => e.status === 'SUBMITTED').length,
    approvedCount: timeLogs.filter((l) => l.status === 'APPROVED').length + expenses.filter((e) => e.status === 'APPROVED').length,
  };

  const submitTimesheet = async () => {
    setSubmittingTimesheet(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        alert('You are not logged in');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const activeCompanyId = userData?.activeCompanyId || userData?.companyId;
      const subRole = userData?.subcontractorRoles?.[activeCompanyId];

      if (!subRole) {
        alert('Subcontractor role not found');
        return;
      }

      const batch = writeBatch(db);

      const draftTimeLogs = timeLogs.filter(log => log.status === 'DRAFT');
      const draftExpenses = expenses.filter(exp => exp.status === 'DRAFT');

      if (draftTimeLogs.length === 0 && draftExpenses.length === 0) {
        alert('No draft items to submit');
        return;
      }

      draftTimeLogs.forEach(log => {
        batch.update(doc(db, 'timeLogs', log.id), {
          status: 'SUBMITTED',
          updatedAt: Timestamp.now(),
        });
      });

      draftExpenses.forEach(exp => {
        batch.update(doc(db, 'expenses', exp.id), {
          status: 'SUBMITTED',
          updatedAt: Timestamp.now(),
        });
      });

      const totalHours = draftTimeLogs.reduce(
        (sum, log) => sum + (log.hoursRegular || 0) + (log.hoursOT || 0),
        0
      );
      const totalCost = draftTimeLogs.reduce((sum, log) => sum + (log.subCost || 0), 0);
      const totalExpenses = draftExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

      const submissionRef = await addDoc(collection(db, 'projectSubmissions'), {
        companyId: activeCompanyId,
        projectId: projectId,
        subcontractorId: subRole.subcontractorId,
        createdByUserId: user.uid,
        timeLogIds: draftTimeLogs.map(log => log.id),
        expenseIds: draftExpenses.map(exp => exp.id),
        status: 'SUBMITTED',
        submittedAt: Timestamp.now(),
        totalHours,
        totalCost,
        totalExpenses,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      await batch.commit();

      setSubmittingTimesheet(false);

      alert(`Timesheet submitted for approval!\n\nSubmission ID: ${submissionRef.id}\nTotal Hours: ${totalHours.toFixed(1)}h\nTotal Cost: £${totalCost.toFixed(2)}`);

      // Navigate back to projects list after a short delay
      setTimeout(() => {
        router.push('/dashboard/my-work/projects');
      }, 1000);
    } catch (error) {
      console.error('Error submitting timesheet:', error);
      alert(`Failed to submit timesheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSubmittingTimesheet(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading project...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-800 mb-2">Error</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => router.push('/dashboard/my-work/projects')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Back to Projects
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="font-semibold text-yellow-800 mb-2">Project Not Found</h3>
            <p className="text-yellow-700 mb-4">The project you're looking for doesn't exist or you don't have access to it.</p>
            <button
              onClick={() => router.push('/dashboard/my-work/projects')}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
            >
              Back to Projects
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800">{success}</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/my-work/projects')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600 mt-1">Client: {clientName}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition ${
                activeTab === 'logs'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 bg-gray-50'
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
                  : 'text-gray-600 hover:text-gray-900 bg-gray-50'
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
                  : 'text-gray-600 hover:text-gray-900 bg-gray-50'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Summary
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Time Logs Tab */}
            {activeTab === 'logs' && (
              <div className="space-y-6">
                {/* Add Time Log Form */}
                <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${summaryStats.submittedCount > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Time Log</h3>
                  {summaryStats.submittedCount > 0 && (
                    <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                      <p className="text-sm text-orange-700">You have submitted items for approval. New items cannot be added until they are approved or rejected.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                      <input
                        type="date"
                        value={logForm.date}
                        onChange={(e) => setLogForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                      <select
                        value={logForm.rateKey}
                        onChange={(e) => setLogForm((p) => ({ ...p, rateKey: e.target.value }))}
                        disabled={rateOptions.length === 0}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm ${
                          rateOptions.length === 0
                            ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                            : 'border-gray-300'
                        }`}
                      >
                        <option value="">
                          {rateOptions.length === 0 ? 'No roles' : 'Choose role...'}
                        </option>
                        {rateOptions.map((o: any) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Shift will be auto-detected from time range</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                      <input
                        type="time"
                        value={logForm.startTime}
                        onChange={(e) => setLogForm((p) => ({ ...p, startTime: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                      <input
                        type="time"
                        value={logForm.endTime}
                        onChange={(e) => setLogForm((p) => ({ ...p, endTime: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Men</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={logForm.quantity}
                        onChange={(e) => setLogForm((p) => ({ ...p, quantity: Math.max(1, Number(e.target.value)) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hours (Auto)</label>
                      <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm font-semibold text-gray-700">
                        {calculatedLog.hours.toFixed(1)}h
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cost Preview</label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-blue-50 text-sm font-bold text-blue-900">
                        £{calculatedLog.cost.toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => saveLog('DRAFT')}
                        disabled={savingLog || rateOptions.length === 0 || payRate === 0}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                      >
                        <Plus className="w-4 h-4 inline mr-1" />
                        Add
                      </button>
                    </div>
                  </div>

                  {rateOptions.length === 0 && (
                    <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-700">
                        No rate card configured. Please contact your administrator.
                      </p>
                    </div>
                  )}

                  {/* Calculation Breakdown */}
                  {calculationBreakdown.length > 0 && (
                    <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-indigo-900 mb-2">📊 Time-Based Calculation Breakdown</h4>
                      <div className="space-y-1">
                        {calculationBreakdown.map((segment: any, idx: number) => (
                          <div key={idx} className="text-xs text-indigo-800 flex justify-between">
                            <span>{segment.timeRange}: {segment.hours.toFixed(1)}h @ £{segment.subRate.toFixed(2)}/hr</span>
                            <span className="font-semibold">£{segment.subCost.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="pt-1 border-t border-indigo-300 flex justify-between text-sm font-bold text-indigo-900">
                          <span>Total: {calculatedLog.hours.toFixed(1)}h</span>
                          <span>£{(calculatedLog.cost / Number(logForm.quantity)).toFixed(2)}</span>
                        </div>
                        {Number(logForm.quantity) > 1 && (
                          <div className="text-xs text-indigo-700">
                            × {logForm.quantity} men = £{calculatedLog.cost.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Time Logs Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Time Logs</h3>
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

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {filteredLogs.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-gray-500">
                        <p>No time logs found</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-gray-900">Date</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-900">Role / Shift</th>
                              <th className="px-4 py-2 text-center font-semibold text-gray-900">Time</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-900">Hours</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-900">Cost</th>
                              <th className="px-4 py-2 text-center font-semibold text-gray-900">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredLogs.map((log) => (
                              <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-900">{formatDate(log.date)}</td>
                                <td className="px-4 py-2 text-gray-900">{log.roleName} - {log.timeframeName || log.shiftType || 'Standard'}</td>
                                <td className="px-4 py-2 text-center text-gray-600 text-xs">{log.startTime && log.endTime ? `${log.startTime}-${log.endTime}` : '-'}</td>
                                <td className="px-4 py-2 text-right text-gray-900">{(log.hoursRegular || 0).toFixed(1)}h</td>
                                <td className="px-4 py-2 text-right text-gray-900 font-semibold">£{(log.subCost || 0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => deleteTimeLog(log.id)}
                                      className="p-1 hover:bg-red-100 rounded transition disabled:opacity-50"
                                      disabled={deletingId !== null}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Subtotal */}
                  {timeLogs.length > 0 && (
                    <div className="mt-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Total Hours</p>
                            <p className="text-2xl font-bold text-blue-900">
                              {timeLogs.reduce((sum, log) => sum + (log.hoursRegular || 0) + (log.hoursOT || 0), 0).toFixed(1)}h
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Total Cost</p>
                            <p className="text-2xl font-bold text-blue-900">
                              £{timeLogs.reduce((sum, log) => sum + (log.subCost || 0), 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Expenses Tab */}
            {activeTab === 'expenses' && (
              <div className="space-y-6">
                {/* Add Expense Form */}
                <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${summaryStats.submittedCount > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Expense</h3>
                  {summaryStats.submittedCount > 0 && (
                    <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                      <p className="text-sm text-orange-700">You have submitted items for approval. New items cannot be added until they are approved or rejected.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expense Type *</label>
                      <select
                        value={expenseForm.expenseKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          const selected = expenseOptions.find((opt: any) => opt.key === key);
                          setExpenseForm((p) => ({
                            ...p,
                            expenseKey: key,
                            quantity: 1,
                            amount: selected ? selected.rate : 0,
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={expenseForm.quantity}
                        onChange={(e) => {
                          const qty = Math.max(0.5, Number(e.target.value));
                          setExpenseForm((p) => ({
                            ...p,
                            quantity: qty,
                            amount: selectedExpense ? Math.min(qty * selectedExpense.rate, selectedExpense.rate) : 0,
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-green-50 text-sm font-bold text-green-900">
                        £{(selectedExpense ? (expenseForm.quantity * selectedExpense.rate) : 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => saveExpense('DRAFT')}
                        disabled={savingExpense || !selectedExpense}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                      >
                        <Plus className="w-4 h-4 inline mr-1" />
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expenses Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Expenses</h3>
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

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {filteredExpenses.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-gray-500">
                        <p>No expenses found</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-gray-900">Date</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-900">Category</th>
                              <th className="px-4 py-2 text-center font-semibold text-gray-900">Qty</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-900">Amount</th>
                              <th className="px-4 py-2 text-center font-semibold text-gray-900">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredExpenses.map((exp) => (
                              <tr key={exp.id} className="border-b border-gray-200 hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-900">{formatDate(exp.date)}</td>
                                <td className="px-4 py-2 text-gray-900">{exp.category}</td>
                                <td className="px-4 py-2 text-center text-gray-900">{(exp.quantity || 1).toFixed(1)}</td>
                                <td className="px-4 py-2 text-right text-gray-900 font-semibold">£{(exp.amount || 0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => deleteExpense(exp.id)}
                                      className="p-1 hover:bg-red-100 rounded transition disabled:opacity-50"
                                      disabled={deletingId !== null}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Subtotal */}
                  {expenses.length > 0 && (
                    <div className="mt-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-2xl font-bold text-green-900">
                            £{expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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

                <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <h4 className="font-semibold text-gray-900 mb-3">Submit for Approval</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Once you submit your timesheet, both time logs and expenses will be sent for approval. You won't be able to edit entries until the approval process is complete.
                  </p>
                  <button
                    disabled={summaryStats.draftCount === 0 || submittingTimesheet}
                    onClick={submitTimesheet}
                    className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    {submittingTimesheet ? 'Submitting...' : 'Submit Timesheet for Approval'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
