/**
 * Utility functions for line item notes (client collaboration)
 */

import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import type { LineItemNote, NoteCreatorRole } from './types';

/**
 * Add a note to a line item (time log or expense)
 */
export async function addLineItemNote(
  itemId: string,
  itemType: 'timeLog' | 'expense',
  projectId: string,
  clientOrgId: string,
  contractorCompanyId: string,
  createdBy: string,
  createdByRole: NoteCreatorRole,
  createdByName: string,
  note: string
): Promise<string> {
  const noteRef = await addDoc(collection(db, 'lineItemNotes'), {
    itemId,
    itemType,
    projectId,
    clientOrgId,
    contractorCompanyId,
    createdBy,
    createdByRole,
    createdByName,
    note,
    isResolved: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return noteRef.id;
}

/**
 * Get all notes for a line item
 */
export async function getLineItemNotes(
  itemId: string
): Promise<LineItemNote[]> {
  const notesQuery = query(
    collection(db, 'lineItemNotes'),
    where('itemId', '==', itemId),
    orderBy('createdAt', 'asc')
  );
  
  const notesSnap = await getDocs(notesQuery);
  return notesSnap.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  } as LineItemNote));
}

/**
 * Get all notes for a project
 */
export async function getProjectNotes(
  projectId: string
): Promise<LineItemNote[]> {
  const notesQuery = query(
    collection(db, 'lineItemNotes'),
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );
  
  const notesSnap = await getDocs(notesQuery);
  return notesSnap.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  } as LineItemNote));
}

/**
 * Get unresolved notes count for a line item
 */
export async function getUnresolvedNotesCount(
  itemId: string
): Promise<number> {
  const notesQuery = query(
    collection(db, 'lineItemNotes'),
    where('itemId', '==', itemId),
    where('isResolved', '==', false)
  );
  
  const notesSnap = await getDocs(notesQuery);
  return notesSnap.size;
}

/**
 * Get unresolved notes counts for multiple line items
 */
export async function getUnresolvedNotesCounts(
  itemIds: string[]
): Promise<Map<string, number>> {
  if (itemIds.length === 0) {
    return new Map();
  }
  
  // Firestore 'in' query supports max 10 items, so we batch
  const batchSize = 10;
  const batches: string[][] = [];
  
  for (let i = 0; i < itemIds.length; i += batchSize) {
    batches.push(itemIds.slice(i, i + batchSize));
  }
  
  const countsMap = new Map<string, number>();
  
  for (const batch of batches) {
    const notesQuery = query(
      collection(db, 'lineItemNotes'),
      where('itemId', 'in', batch),
      where('isResolved', '==', false)
    );
    
    const notesSnap = await getDocs(notesQuery);
    
    // Count notes per item
    notesSnap.docs.forEach(doc => {
      const noteData = doc.data();
      const itemId = noteData.itemId;
      countsMap.set(itemId, (countsMap.get(itemId) || 0) + 1);
    });
  }
  
  return countsMap;
}

/**
 * Mark a note as resolved
 */
export async function resolveNote(
  noteId: string,
  resolvedBy: string
): Promise<void> {
  await updateDoc(doc(db, 'lineItemNotes', noteId), {
    isResolved: true,
    resolvedBy,
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mark a note as unresolved
 */
export async function unresolveNote(
  noteId: string
): Promise<void> {
  await updateDoc(doc(db, 'lineItemNotes', noteId), {
    isResolved: false,
    resolvedBy: null,
    resolvedAt: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get statistics for notes on a project
 */
export async function getProjectNotesStats(
  projectId: string
): Promise<{
  total: number;
  unresolved: number;
  resolved: number;
  byClient: number;
  byContractor: number;
}> {
  const notesQuery = query(
    collection(db, 'lineItemNotes'),
    where('projectId', '==', projectId)
  );
  
  const notesSnap = await getDocs(notesQuery);
  const notes = notesSnap.docs.map(doc => doc.data());
  
  return {
    total: notes.length,
    unresolved: notes.filter(n => !n.isResolved).length,
    resolved: notes.filter(n => n.isResolved).length,
    byClient: notes.filter(n => n.createdByRole === 'CLIENT').length,
    byContractor: notes.filter(n => n.createdByRole === 'ADMIN' || n.createdByRole === 'MANAGER').length,
  };
}
