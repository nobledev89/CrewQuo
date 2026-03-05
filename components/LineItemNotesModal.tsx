'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, CheckCircle, Clock, Send } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  getLineItemNotes,
  addLineItemNote,
  resolveNote,
  unresolveNote,
} from '@/lib/lineItemNotesUtils';
import type { LineItemNote } from '@/lib/types';

interface LineItemNotesModalProps {
  itemId: string;
  itemType: 'timeLog' | 'expense';
  itemDescription: string;
  projectId: string;
  clientOrgId: string;
  contractorCompanyId: string;
  onClose: () => void;
  allowClientNotes: boolean;
}

export default function LineItemNotesModal({
  itemId,
  itemType,
  itemDescription,
  projectId,
  clientOrgId,
  contractorCompanyId,
  onClose,
  allowClientNotes,
}: LineItemNotesModalProps) {
  const { user, userData } = useAuth();
  const [notes, setNotes] = useState<LineItemNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [itemId]);

  const loadNotes = async () => {
    try {
      const notesData = await getLineItemNotes(itemId);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !user || !userData) return;

    setSubmitting(true);
    try {
      const createdByRole = userData.role === 'CLIENT' ? 'CLIENT' : (userData.role === 'ADMIN' ? 'ADMIN' : 'MANAGER');
      const createdByName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email;

      await addLineItemNote(
        itemId,
        itemType,
        projectId,
        clientOrgId,
        contractorCompanyId,
        user.uid,
        createdByRole,
        createdByName,
        newNote.trim()
      );

      setNewNote('');
      await loadNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleResolve = async (note: LineItemNote) => {
    try {
      if (note.isResolved) {
        await unresolveNote(note.id);
      } else {
        await resolveNote(note.id, user!.uid);
      }
      await loadNotes();
    } catch (error) {
      console.error('Error toggling resolve:', error);
      alert('Failed to update note status. Please try again.');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isClient = userData?.role === 'CLIENT';
  const canAddNotes = isClient ? allowClientNotes : true;
  const canResolve = !isClient; // Only contractors can resolve notes

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <MessageSquare className="w-6 h-6 text-blue-600" />
              <span>Line Item Notes</span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">{itemDescription}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading notes...</p>
              </div>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No notes yet</h4>
              <p className="text-gray-600">Be the first to add a note or question!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`border rounded-lg p-4 ${
                    note.isResolved
                      ? 'bg-gray-50 border-gray-200'
                      : note.createdByRole === 'CLIENT'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          note.createdByRole === 'CLIENT' ? 'bg-blue-600' : 'bg-green-600'
                        }`}
                      >
                        {note.createdByName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{note.createdByName}</p>
                        <p className="text-xs text-gray-500">
                          {note.createdByRole === 'CLIENT' ? 'Client' : 'Contractor'} • {formatDate(note.createdAt)}
                        </p>
                      </div>
                    </div>
                    {note.isResolved && (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                        <CheckCircle className="w-3 h-3" />
                        <span>Resolved</span>
                      </span>
                    )}
                  </div>

                  <p className="text-gray-800 mb-3 whitespace-pre-wrap">{note.note}</p>

                  {canResolve && (
                    <button
                      onClick={() => handleToggleResolve(note)}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg transition ${
                        note.isResolved
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {note.isResolved ? 'Mark as Unresolved' : 'Mark as Resolved'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Note Form */}
        {canAddNotes && (
          <div className="border-t border-gray-200 p-6">
            <form onSubmit={handleAddNote}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add a note or question
              </label>
              <div className="flex space-x-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={isClient ? "Ask a question or provide feedback..." : "Respond to client's inquiry..."}
                  rows={3}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <button
                  type="submit"
                  disabled={submitting || !newNote.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 h-fit"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {!canAddNotes && (
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <p className="text-sm text-gray-600 text-center">
              Note-taking is disabled for this project. Contact your contractor if you need assistance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
