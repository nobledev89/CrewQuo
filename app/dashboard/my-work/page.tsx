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
  Timestamp,
} from 'firebase/firestore';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardSummary from '@/components/DashboardSummary';
import ProjectModal from '@/components/ProjectModal';
import { Briefcase, Search, Filter } from 'lucide-react';

interface Assignment {
  id: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  projectStatus: string;
  pendingCount: number;
  hoursLogged: number;
}

interface RateAssignment {
  clientId: string;
  payRateCardId: string;
  billRateCardId: string;
}

interface RateCard {
  id: string;
  name: string;
  cardType: 'PAY' | 'BILL';
  rates: any[];
  expenses: any[];
}

interface TimeLog {
  id: string;
  projectId: string;
  date: any;
  hoursRegular: number;
  hoursOT: number;
  subCost: number;
  status: string;
}

interface Expense {
  id: string;
  projectId: string;
  amount: number;
  status: string;
  date: any;
}

export default function MyWorkPage() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [subcontractorId, setSubcontractorId] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [rateAssignments, setRateAssignments] = useState<Map<string, RateAssignment>>(new Map());
  const [rateCards, setRateCards] = useState<Map<string, RateCard>>(new Map());
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  // UI State
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<Assignment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeProjectsLimit, setActiveProjectsLimit] = useState(10);
  const [completedProjectsLimit, setCompletedProjectsLimit] = useState(10);

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

        const subRole = userData.subcontractorRoles?.[activeId];
        if (!subRole) {
          setLoading(false);
          return;
        }
        setSubcontractorId(subRole.subcontractorId);

        await Promise.all([
          fetchAssignments(activeId, subRole.subcontractorId),
          fetchRateAssignments(activeId, subRole.subcontractorId),
          fetchTimeLogs(activeId, subRole.subcontractorId, currentUser.uid),
          fetchExpenses(activeId, subRole.subcontractorId, currentUser.uid),
        ]);
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
        projectStatus: project.status || 'ACTIVE',
        pendingCount: 0,
        hoursLogged: 0,
      });
    }
    setAssignments(projects);
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
    const logs: TimeLog[] = snap.docs.map((d) => ({
      id: d.id,
      projectId: d.data().projectId,
      date: d.data().date,
      hoursRegular: d.data().hoursRegular || 0,
      hoursOT: d.data().hoursOT || 0,
      subCost: d.data().subCost || 0,
      status: d.data().status || 'DRAFT',
    }));
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
    const exps: Expense[] = snap.docs.map((d) => ({
      id: d.id,
      projectId: d.data().projectId,
      amount: d.data().amount || 0,
      status: d.data().status || 'DRAFT',
      date: d.data().date,
    }));
    setExpenses(exps);
  };

  // Calculate monthly stats (from 1st of current month to today)
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyLogs = timeLogs.filter((log) => {
      const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
      return logDate >= monthStart;
    });

    const monthlyExpenses = expenses.filter((exp) => {
      const expDate = exp.date?.toDate ? exp.date.toDate() : new Date(exp.date);
      return expDate >= monthStart;
    });

    const monthlyHours = monthlyLogs.reduce(
      (sum, log) => sum + log.hoursRegular + log.hoursOT,
      0
    );

    const monthlyEarnings = monthlyLogs
      .filter((log) => log.status === 'APPROVED')
      .reduce((sum, log) => sum + log.subCost, 0);

    const pendingCount =
      timeLogs.filter((log) => log.status === 'DRAFT').length +
      expenses.filter((exp) => exp.status === 'DRAFT').length;

    const submittedCount =
      timeLogs.filter((log) => log.status === 'SUBMITTED').length +
      expenses.filter((exp) => exp.status === 'SUBMITTED').length;

    return {
      monthlyHours,
      monthlyEarnings,
      pendingCount,
      submittedCount,
    };
  }, [timeLogs, expenses]);

  // Enrich assignments with stats
  const enrichedAssignments = useMemo(() => {
    return assignments.map((assignment) => {
      const projectLogs = timeLogs.filter((log) => log.projectId === assignment.projectId);
      const projectExpenses = expenses.filter((exp) => exp.projectId === assignment.projectId);
      
      const hoursLogged = projectLogs.reduce(
        (sum, log) => sum + log.hoursRegular + log.hoursOT,
        0
      );

      const pendingCount =
        projectLogs.filter((log) => log.status === 'DRAFT').length +
        projectExpenses.filter((exp) => exp.status === 'DRAFT').length;

      return {
        ...assignment,
        hoursLogged,
        pendingCount,
      };
    });
  }, [assignments, timeLogs, expenses]);

  // Filter and search projects
  const filteredProjects = useMemo(() => {
    let filtered = enrichedAssignments;

    // Status filter
    if (statusFilter !== 'all') {
      const statusMap = {
        active: 'ACTIVE',
        completed: 'COMPLETED',
        on_hold: 'ON_HOLD',
      };
      filtered = filtered.filter((p) => p.projectStatus === statusMap[statusFilter]);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.projectName.toLowerCase().includes(query) ||
          p.clientName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [enrichedAssignments, statusFilter, searchQuery]);

  // Separate active and completed projects
  const activeProjects = filteredProjects
    .filter((p) => p.projectStatus === 'ACTIVE')
    .slice(0, activeProjectsLimit);
  
  const completedProjects = filteredProjects
    .filter((p) => p.projectStatus === 'COMPLETED' || p.projectStatus === 'ON_HOLD')
    .slice(0, completedProjectsLimit);

  const hasMoreActive = filteredProjects.filter((p) => p.projectStatus === 'ACTIVE').length > activeProjectsLimit;
  const hasMoreCompleted = filteredProjects.filter((p) => p.projectStatus === 'COMPLETED' || p.projectStatus === 'ON_HOLD').length > completedProjectsLimit;

  const openProjectModal = (project: Assignment) => {
    setSelectedProject(project);
    setShowModal(true);
  };

  const closeProjectModal = () => {
    setShowModal(false);
    setSelectedProject(null);
    // Refresh data
    if (auth.currentUser) {
      const userDoc = getDoc(doc(db, 'users', auth.currentUser.uid));
      userDoc.then((doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          const activeId = userData.activeCompanyId || userData.companyId;
          const subRole = userData.subcontractorRoles?.[activeId];
          if (subRole) {
            fetchTimeLogs(activeId, subRole.subcontractorId, auth.currentUser!.uid);
            fetchExpenses(activeId, subRole.subcontractorId, auth.currentUser!.uid);
          }
        }
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      ACTIVE: 'bg-green-100 text-green-800 border-green-200',
      COMPLETED: 'bg-blue-100 text-blue-800 border-blue-200',
      ON_HOLD: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800 border-gray-200';
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

  // Check if user is a subcontractor
  const isSubcontractor = userRole === 'SUBCONTRACTOR' || subcontractorId !== '';

  if (!isSubcontractor) {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600 mt-1">Manage your assigned projects and submit time logs</p>
          </div>
        </div>

        {/* Dashboard Summary */}
        <DashboardSummary
          monthlyHours={monthlyStats.monthlyHours}
          pendingCount={monthlyStats.pendingCount}
          submittedCount={monthlyStats.submittedCount}
          monthlyEarnings={monthlyStats.monthlyEarnings}
          loading={false}
        />

        {/* Filters and Search */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Status Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-5 h-5 text-gray-500" />
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  statusFilter === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  statusFilter === 'completed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setStatusFilter('on_hold')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  statusFilter === 'on_hold'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                On Hold
              </button>
            </div>

            {/* Search */}
            <div className="relative flex-1 md:max-w-xs">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Active Projects */}
        {activeProjects.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Active Projects ({filteredProjects.filter((p) => p.projectStatus === 'ACTIVE').length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => openProjectModal(project)}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md hover:border-blue-300 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{project.projectName}</h3>
                      <p className="text-sm text-gray-600">{project.clientName}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(project.projectStatus)}`}>
                      {project.projectStatus}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500">Hours Logged</p>
                      <p className="text-lg font-bold text-blue-600">{project.hoursLogged.toFixed(1)}h</p>
                    </div>
                    {project.pendingCount > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Pending</p>
                        <p className="text-lg font-bold text-yellow-600">{project.pendingCount}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <button className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium">
                      Open Project →
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMoreActive && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setActiveProjectsLimit((prev) => prev + 10)}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Load More Active Projects
                </button>
              </div>
            )}
          </div>
        )}

        {/* Completed/On Hold Projects */}
        {completedProjects.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Completed & On Hold Projects ({filteredProjects.filter((p) => p.projectStatus !== 'ACTIVE').length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => openProjectModal(project)}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md hover:border-blue-300 transition cursor-pointer opacity-75"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{project.projectName}</h3>
                      <p className="text-sm text-gray-600">{project.clientName}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(project.projectStatus)}`}>
                      {project.projectStatus}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500">Hours Logged</p>
                      <p className="text-lg font-bold text-gray-600">{project.hoursLogged.toFixed(1)}h</p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <button className="w-full px-4 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition text-sm font-medium">
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMoreCompleted && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setCompletedProjectsLimit((prev) => prev + 10)}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Load More Completed Projects
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600">
              {searchQuery ? 'Try adjusting your search or filters.' : 'No projects assigned yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Project Modal */}
      {selectedProject && (
        <ProjectModal
          isOpen={showModal}
          onClose={closeProjectModal}
          project={selectedProject}
          rateAssignment={rateAssignments.get(selectedProject.clientId) || null}
          rateCards={rateCards}
        />
      )}
    </DashboardLayout>
  );
}
