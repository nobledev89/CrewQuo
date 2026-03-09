'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  FileText,
  Filter,
  Download,
  Calendar,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import type { AuditLog } from '@/lib/types';

type DateFilter = '7days' | '30days' | '90days' | 'custom';

export default function AuditLogsPage() {
  const router = useRouter();
  const { userData, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('30days');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // UI state
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // Redirect non-admin/manager users
  useEffect(() => {
    if (!authLoading && userData) {
      if (userData.role !== 'ADMIN' && userData.role !== 'MANAGER') {
        router.push('/dashboard');
      }
    }
  }, [authLoading, userData, router]);

  useEffect(() => {
    const loadLogs = async () => {
      if (!userData || !userData.activeCompanyId) return;
      
      setLoading(true);
      setError('');
      
      try {
        const companyId = userData.activeCompanyId;
        setActiveCompanyId(companyId);

        // Calculate date range
        const now = new Date();
        let startTimestamp: Timestamp;
        
        if (dateFilter === 'custom' && startDate) {
          startTimestamp = Timestamp.fromDate(new Date(startDate));
        } else {
          const daysAgo = dateFilter === '7days' ? 7 : dateFilter === '30days' ? 30 : 90;
          const startDateCalc = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
          startTimestamp = Timestamp.fromDate(startDateCalc);
        }

        // Build query
        let logsQuery = query(
          collection(db, 'auditLogs'),
          where('companyId', '==', companyId),
          where('timestamp', '>=', startTimestamp),
          orderBy('timestamp', 'desc'),
          limit(500)
        );

        const snapshot = await getDocs(logsQuery);
        const logsData: AuditLog[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as AuditLog));

        setLogs(logsData);
        applyFilters(logsData);
      } catch (err) {
        console.error('Error loading audit logs:', err);
        setError('Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && userData) {
      loadLogs();
    }
  }, [authLoading, userData, dateFilter, startDate]);

  const applyFilters = (logsToFilter: AuditLog[] = logs) => {
    let filtered = [...logsToFilter];

    // Entity type filter
    if (entityTypeFilter !== 'all') {
      filtered = filtered.filter(log => log.entityType === entityTypeFilter);
    }

    // Action filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // User filter
    if (userFilter !== 'all') {
      filtered = filtered.filter(log => log.userId === userFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.entityName?.toLowerCase().includes(query) ||
        log.userName?.toLowerCase().includes(query) ||
        log.description?.toLowerCase().includes(query) ||
        log.projectName?.toLowerCase().includes(query)
      );
    }

    // Custom date range filter
    if (dateFilter === 'custom' && endDate) {
      const endTimestamp = new Date(endDate).getTime();
      filtered = filtered.filter(log => {
        const logTime = log.timestamp.toDate().getTime();
        return logTime <= endTimestamp;
      });
    }

    setFilteredLogs(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [entityTypeFilter, actionFilter, userFilter, searchQuery, endDate]);

  const exportToCSV = () => {
    const rows: string[][] = [];
    
    // Header
    rows.push([
      'Timestamp',
      'Action',
      'Entity Type',
      'Entity Name',
      'User',
      'Role',
      'Project',
      'Description',
      'Changes'
    ]);

    // Data rows
    filteredLogs.forEach(log => {
      const changes = log.changes?.map(c => `${c.field}: ${c.oldValue} → ${c.newValue}`).join('; ') || '';
      rows.push([
        log.timestamp.toDate().toLocaleString('en-GB'),
        log.action,
        log.entityType,
        log.entityName || '',
        log.userName || '',
        log.userRole || '',
        log.projectName || '',
        log.description || '',
        changes
      ]);
    });

    // Convert to CSV
    const csvContent = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-700';
      case 'UPDATE': return 'bg-blue-100 text-blue-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      case 'APPROVE': return 'bg-emerald-100 text-emerald-700';
      case 'REJECT': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getEntityTypeIcon = (entityType: string) => {
    switch (entityType) {
      case 'TIME_LOG': return '⏱️';
      case 'EXPENSE': return '💰';
      case 'TIMESHEET': return '📋';
      case 'RATE_CARD': return '💳';
      case 'RATE_TEMPLATE': return '📝';
      case 'PROJECT': return '🏗️';
      default: return '📄';
    }
  };

  // Get unique values for filters
  const uniqueEntityTypes = Array.from(new Set(logs.map(log => log.entityType)));
  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueUsers = Array.from(new Set(logs.map(log => log.userId)));
  const userMap = new Map(logs.map(log => [log.userId, log.userName]));

  if (loading || authLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading audit logs...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!userData || (userData.role !== 'ADMIN' && userData.role !== 'MANAGER')) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-gray-600 mt-1">Track all changes and activities in your system</p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV ({filteredLogs.length})
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => setShowFilters(!showFilters)}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            </div>
            {showFilters ? (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            )}
          </div>

          {showFilters && (
            <div className="p-4 border-t border-gray-200 space-y-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by entity, user, project..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="90days">Last 90 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {/* Entity Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entity Type
                  </label>
                  <select
                    value={entityTypeFilter}
                    onChange={(e) => setEntityTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Types</option>
                    {uniqueEntityTypes.map(type => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                {/* Action */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action
                  </label>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Actions</option>
                    {uniqueActions.map(action => (
                      <option key={action} value={action}>{action}</option>
                    ))}
                  </select>
                </div>

                {/* User */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    User
                  </label>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Users</option>
                    {uniqueUsers.map(userId => (
                      <option key={userId} value={userId}>
                        {userMap.get(userId) || userId}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Date Range */}
              {dateFilter === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            Showing <span className="font-semibold">{filteredLogs.length}</span> of{' '}
            <span className="font-semibold">{logs.length}</span> audit log entries
          </p>
        </div>

        {/* Audit Logs List */}
        <div className="space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No audit logs found</p>
              <p className="text-sm text-gray-500">Try adjusting your filters</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition"
              >
                {/* Log Header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{getEntityTypeIcon(log.entityType)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {log.entityType.replace(/_/g, ' ')}
                          </span>
                          {log.entityName && (
                            <span className="text-sm text-gray-600">
                              • {log.entityName}
                            </span>
                          )}
                        </div>
                        {log.description && (
                          <p className="text-sm text-gray-700 mb-2">{log.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{log.userName || 'Unknown'}</span>
                            {log.userRole && <span className="text-gray-400">({log.userRole})</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{log.timestamp.toDate().toLocaleString('en-GB')}</span>
                          </div>
                          {log.projectName && (
                            <div className="flex items-center gap-1">
                              <span>🏗️</span>
                              <span>{log.projectName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {expandedLog === log.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedLog === log.id && log.changes && log.changes.length > 0 && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Field Changes:</h4>
                    <div className="space-y-2">
                      {log.changes.map((change, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="text-sm font-medium text-gray-900 mb-1">
                            {change.field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-red-600 line-through">
                              {change.displayOld || change.oldValue || '(empty)'}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-green-600 font-medium">
                              {change.displayNew || change.newValue || '(empty)'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
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
