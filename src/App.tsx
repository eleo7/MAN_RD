import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from './lib/firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { AgendaItem, Task, LocationData, StatusType, PriorityType, normalizeStatus, getWeekNumber, ColumnConfig, DEFAULT_COLUMNS } from './types';
import TableView from './components/TableView';
import CalendarView from './components/CalendarView';
import ChartView from './components/ChartView';
import { exportToExcel, parseExcelFile } from './utils/excel';
import { 
  FileText, 
  Calendar as CalendarIcon, 
  BarChart3, 
  LogOut, 
  Upload,
  DownloadCloud,
  LogIn, 
  Download, 
  Share2, 
  Plus, 
  X, 
  PlusCircle, 
  Check, 
  Trash2, 
  Globe, 
  Lock, 
  Camera, 
  CheckSquare, 
  AlertCircle,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  Search,
  Undo2,
  Redo2,
  Sun,
  Moon
} from 'lucide-react';
import html2canvas from 'html2canvas';

type ActiveTab = 'table' | 'calendar' | 'charts';

function getNumericTime(val: any): number {
  if (!val) return 0;
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
  }
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof val.toDate === 'function') {
    return val.toDate().getTime();
  }
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('table');
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Handlers for public viewer layout
  const [publicItem, setPublicItem] = useState<AgendaItem | null>(null);
  const [publicLoading, setPublicLoading] = useState(false);

  // Form task state
  const [newTaskText, setNewTaskText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearDataConfirm, setClearDataConfirm] = useState(false);
  
  // Theme state (light / dark)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('manutencao_theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  // Columns settings configuration state
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('manutencao_columns_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed parsing columns config", e);
      }
    }
    return DEFAULT_COLUMNS;
  });

  // Persist columns changes
  useEffect(() => {
    localStorage.setItem('manutencao_columns_config', JSON.stringify(columns));
  }, [columns]);

  // Undo/redo history states
  const [history, setHistory] = useState<AgendaItem[][]>([]);
  const [redoStack, setRedoStack] = useState<AgendaItem[][]>([]);

  // Throttling references for text inputs push-to-history
  const lastHistoryPushTime = useRef<number>(0);
  const lastEditedItemAndField = useRef<string>('');

  // Sync theme class onto the document root
  useEffect(() => {
    localStorage.setItem('manutencao_theme', theme);
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Clone and push state helper
  const pushToHistory = (currentItems: AgendaItem[]) => {
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(currentItems))]);
    setRedoStack([]);
  };
  
  // Toast alert for duplicate lines
  const [duplicateToast, setDuplicateToast] = useState<{ id: string; title: string; date: string } | null>(null);
  
  // Auth error message state
  const [authError, setAuthError] = useState<string | null>(null);

  // Auto-dismiss duplicate toast
  useEffect(() => {
    if (duplicateToast) {
      const timer = setTimeout(() => {
        setDuplicateToast(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [duplicateToast]);

  // Element references for screen capturing
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect connection status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 1. Initial Offline Cache loading
  useEffect(() => {
    const cached = localStorage.getItem('notion_offline_cache');
    if (cached) {
      try {
        setItems(JSON.parse(cached));
      } catch (e) {
        console.error("Failed to parse offline cache", e);
      }
    }
  }, []);

  // 2. Auth State Watcher
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // 3. Resolve Public Shared Link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('item');
    if (itemId) {
      setPublicLoading(true);
      const docRef = doc(db, 'agendaItems', itemId);
      getDoc(docRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as AgendaItem;
            if (data.isPublic) {
              setPublicItem({ ...data, id: snapshot.id });
            }
          }
          setPublicLoading(false);
        })
        .catch((err) => {
          console.error("Error loading shared link item", err);
          setPublicLoading(false);
        });
    }
  }, []);

  // 4. Real-time Firestore Sync for Authenticated User
  useEffect(() => {
    if (authLoading) return;

    if (!currentUser) {
      if (!new URLSearchParams(window.location.search).get('item')) {
        setItems([]);
      }
      return;
    }

    if (currentUser.uid === 'guest_user') {
      const cached = localStorage.getItem('notion_offline_cache');
      if (cached) {
        try {
          const cachedItems = JSON.parse(cached) as AgendaItem[];
          setItems(cachedItems);
        } catch (e) {
          console.warn("Failed to load offline cache in guest mode", e);
        }
      }
      return;
    }

    const q = query(
      collection(db, 'agendaItems'), 
      where('ownerId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: AgendaItem[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ ...doc.data() as AgendaItem, id: doc.id });
      });
      
      // Find any items in local storage belonging to the current user
      const cached = localStorage.getItem('notion_offline_cache');
      let finalItems: AgendaItem[] = [];
      let unsyncedLocalItems: AgendaItem[] = [];

      if (cached) {
        try {
          const cachedItems = JSON.parse(cached) as AgendaItem[];
          const cachedMap = new Map(cachedItems.filter(Boolean).map(item => [item.id, item]));
          const fetchedIds = new Set(fetched.map(i => i.id));

          // 1. Process fetched items: if cache has a newer version, use that.
          finalItems = fetched.map(fetchedItem => {
            const cachedItem = cachedMap.get(fetchedItem.id);
            if (cachedItem) {
              const fetchedTime = getNumericTime(fetchedItem.updatedAt);
              const cachedTime = getNumericTime(cachedItem.updatedAt);
              if (cachedTime > fetchedTime) {
                return cachedItem;
              }
            }
            return fetchedItem;
          });
          
          // 2. Filter items belonging to the current user that don't exist in the Firestore fetched collection yet
          unsyncedLocalItems = cachedItems.filter(item => 
            item && item.ownerId === currentUser.uid && !fetchedIds.has(item.id)
          );
          
          if (unsyncedLocalItems.length > 0) {
            finalItems = [...finalItems, ...unsyncedLocalItems];
          }
        } catch (e) {
          console.warn("Could not read local cache for merge comparison:", e);
          finalItems = [...fetched];
        }
      } else {
        finalItems = [...fetched];
      }

      // Sort items by orderIndex ascending first (if exists), then by date descending
      finalItems.sort((a, b) => {
        if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
          return a.orderIndex - b.orderIndex;
        }
        if (a.orderIndex !== undefined) return -1;
        if (b.orderIndex !== undefined) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      setItems(finalItems);
      localStorage.setItem('notion_offline_cache', JSON.stringify(finalItems));

      // Asynchronously upload any unsynced items to Firestore so they are saved to the remote database
      if (unsyncedLocalItems.length > 0) {
        unsyncedLocalItems.forEach(async (item) => {
          try {
            const docRef = doc(db, 'agendaItems', item.id);
            await setDoc(docRef, {
              ...item,
              createdAt: item.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            console.log(`Synchronized offline item ${item.id} to your Firestore.`);
          } catch (writeErr) {
            console.warn(`Background sync failed for item ${item.id}`, writeErr);
          }
        });
      }
    }, (error) => {
      console.warn("Firestore sync warning (running in offline fallback mode):", error.message);
      // Fallback safely to localStorage data when unauthorized or offline
      const cached = localStorage.getItem('notion_offline_cache');
      if (cached) {
        try {
          const cachedItems = JSON.parse(cached) as AgendaItem[];
          const userItems = cachedItems.filter(item => item && item.ownerId === currentUser.uid);
          setItems(userItems);
        } catch (e) {
          console.error("Failed to restore items from fallback cache:", e);
        }
      }
    });

    return unsubscribe;
  }, [currentUser, authLoading]);

  // Auth logins
  const handleLogin = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error("Authentication failed", e);
      if (e?.code === 'auth/unauthorized-domain' || e?.message?.includes('unauthorized-domain')) {
        setAuthError("Erro: Este domínio não está autorizado no Authentication do seu projeto Firebase 'man-rd'. Por favor, adicione '" + window.location.hostname + "' na lista de Domínios Autorizados em seu Console do Firebase para permitir logins.");
      } else {
        setAuthError(e?.message || String(e));
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('notion_offline_cache');
      setItems([]);
      setSelectedItem(null);
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  // ---------------------------------------------------------------------------
  // UNDO / REDO / CLEAR DATA ACTIONS
  // ---------------------------------------------------------------------------
  const syncUndoRedoToFirestore = async (oldItems: AgendaItem[], newItems: AgendaItem[]) => {
    if (!currentUser || currentUser.uid === 'guest_user') return;
    const oldMap = new Map(oldItems.map(item => [item.id, item]));
    const newMap = new Map(newItems.map(item => [item.id, item]));
    const promises = [];
    
    // 1. Delete items that were in oldItems but aren't in newItems (future additions)
    for (const oldItem of oldItems) {
      if (!newMap.has(oldItem.id)) {
        const docRef = doc(db, 'agendaItems', oldItem.id);
        promises.push(deleteDoc(docRef).catch(e => console.warn("Firestore delete failed in sync", e)));
      }
    }
    
    // 2. Add or update items that are in newItems (future updates or deletes)
    for (const newItem of newItems) {
      const oldItem = oldMap.get(newItem.id);
      if (!oldItem) {
        // Re-create deleted/missing item
        const docRef = doc(db, 'agendaItems', newItem.id);
        promises.push(setDoc(docRef, {
          ...newItem,
          updatedAt: serverTimestamp()
        }).catch(e => console.warn("Firestore recreate failed in sync", e)));
      } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
        // Update modified fields
        const docRef = doc(db, 'agendaItems', newItem.id);
        promises.push(setDoc(docRef, {
          ...newItem,
          updatedAt: serverTimestamp()
        }).catch(e => console.warn("Firestore update failed in sync", e)));
      }
    }
    
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    setRedoStack((prev) => [JSON.parse(JSON.stringify(items)), ...prev]);
    setHistory(newHistory);
    
    setItems(previousState);
    localStorage.setItem('notion_offline_cache', JSON.stringify(previousState));
    
    await syncUndoRedoToFirestore(items, previousState);
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[0];
    const newRedoStack = redoStack.slice(1);
    
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(items))]);
    setRedoStack(newRedoStack);
    
    setItems(nextState);
    localStorage.setItem('notion_offline_cache', JSON.stringify(nextState));
    
    await syncUndoRedoToFirestore(items, nextState);
  };

  const handleClearAllData = async () => {
    if (!currentUser) return;
    pushToHistory(items);
    
    const itemsToClear = [...items];
    setItems([]);
    localStorage.setItem('notion_offline_cache', JSON.stringify([]));
    setClearDataConfirm(false);
    setSelectedItem(null);
    
    try {
      const promises = itemsToClear.map((item) => {
        const docRef = doc(db, 'agendaItems', item.id);
        return deleteDoc(docRef);
      });
      await Promise.all(promises);
    } catch (error) {
      console.warn("Working offline. Cleared elements locally.", error);
    }
  };

  // Excel File trigger and notifications states
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [excelMessage, setExcelMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Auto-dismiss Excel import notifications
  useEffect(() => {
    if (excelMessage) {
      const timer = setTimeout(() => {
        setExcelMessage(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [excelMessage]);

  const handleExportExcel = () => {
    if (items.length === 0) {
      alert("Nenhum dado disponível para exportar!");
      return;
    }
    exportToExcel(items, "Manutencao_Goiania_RD.xlsx");
  };

  const handleImportExcelClick = () => {
    if (!currentUser) {
      alert("Faça login para importar!");
      return;
    }
    excelInputRef.current?.click();
  };

  const handleImportExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!currentUser) return;

    setExcelImportLoading(true);
    setExcelMessage(null);

    try {
      const parsed = await parseExcelFile(file, currentUser.uid);
      if (parsed.length === 0) {
        throw new Error("Não foi possível ler ou mapear nenhuma linha válida da planilha.");
      }

      // Track undo history state
      pushToHistory(items);

      // Construct and fill timestamps
      const fullItems = parsed.map(item => ({
        ...item,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as AgendaItem));

      // Append locally for responsive visual refresh
      const merged = [...fullItems, ...items];
      setItems(merged);
      localStorage.setItem('notion_offline_cache', JSON.stringify(merged));

      // Synchronize in background with Firestore
      if (currentUser.uid !== 'guest_user') {
        const promises = fullItems.map(async (newItem) => {
          const docRef = doc(db, 'agendaItems', newItem.id);
          return setDoc(docRef, {
            ...newItem,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });

        await Promise.all(promises);
      }

      setExcelMessage({
        text: `Sucesso! Planilha importada. ${fullItems.length} registros inseridos com sucesso no seu cronograma.`,
        isError: false
      });
    } catch (err: any) {
      console.error("Excel raw error details", err);
      setExcelMessage({
        text: `Erro ao importar Excel: ${err.message || 'Verifique o formato das colunas do arquivo.'}`,
        isError: true
      });
    } finally {
      setExcelImportLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect Ctrl+T or Cmd+T (Open popup or new task creation)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleAddItem();
      }
      // Detect Ctrl+Z or Cmd+Z (Undo)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Detect Ctrl+Y or Cmd+Y (Redo)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
      // Detect Ctrl+Shift+Z or Cmd+Shift+Z (Redo copycat)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [items, history, redoStack, currentUser]);

  // Add Item Handler
  const handleAddItem = async (initialData?: Partial<AgendaItem>) => {
    if (!currentUser) return;

    // Find the date of the last registered item, if any, to use as default date
    let lastRegisteredDate = '';
    if (items && items.length > 0) {
      let latestItem = items[0];
      let maxTime = 0;
      
      items.forEach(item => {
        let t = 0;
        if (item.createdAt) {
          if (typeof item.createdAt === 'object' && item.createdAt !== null && 'seconds' in item.createdAt) {
            t = (item.createdAt as any).seconds * 1000;
          } else {
            const timeVal = new Date(item.createdAt).getTime();
            t = isNaN(timeVal) ? 0 : timeVal;
          }
        } else if (item.updatedAt) {
          if (typeof item.updatedAt === 'object' && item.updatedAt !== null && 'seconds' in item.updatedAt) {
            t = (item.updatedAt as any).seconds * 1000;
          } else {
            const timeVal = new Date(item.updatedAt).getTime();
            t = isNaN(timeVal) ? 0 : timeVal;
          }
        }
        if (t > maxTime) {
          maxTime = t;
          latestItem = item;
        }
      });
      
      if (latestItem && latestItem.date) {
        lastRegisteredDate = latestItem.date;
      } else {
        lastRegisteredDate = items[0].date;
      }
    }

    const itemId = 'item_' + Date.now().toString(36);
    const chosenDate = initialData?.date || lastRegisteredDate || new Date().toISOString().split('T')[0];
    const calculatedSemana = initialData?.semana || getWeekNumber(chosenDate);

    const newItem: AgendaItem = {
      id: itemId,
      title: initialData?.title || 'SI ' + Math.floor(100000 + Math.random() * 900000) + ' - Atividade',
      semana: calculatedSemana,
      date: chosenDate,
      status: normalizeStatus(initialData?.status) || 'PROGRAMADO',
      quant: initialData?.quant !== undefined ? initialData?.quant : null,
      priority: initialData?.priority as PriorityType || 'Media',
      location: initialData?.location || null,
      tasks: initialData?.tasks || [],
      photos: initialData?.photos || [],
      notes: initialData?.notes || '',
      ownerId: currentUser?.uid || 'guest_user',
      isPublic: initialData?.isPublic || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to history before modifying state
    pushToHistory(items);

    // Update locally first for offline instant reactivity
    const updatedItems = [newItem, ...items];
    setItems(updatedItems);
    localStorage.setItem('notion_offline_cache', JSON.stringify(updatedItems));

    // Check for duplicate row alert trigger
    if (newItem.title && newItem.title.trim() && newItem.date) {
      const cleanTitle = newItem.title.trim().toLowerCase();
      const hasDuplicate = items.some(item => 
        item.title && item.title.trim().toLowerCase() === cleanTitle &&
        item.date === newItem.date
      );
      if (hasDuplicate) {
        setDuplicateToast({
          id: newItem.id,
          title: newItem.title,
          date: newItem.date
        });
      }
    }

    if (currentUser && currentUser.uid !== 'guest_user') {
      try {
        // Create document in Firestore
        const docRef = doc(db, 'agendaItems', itemId);
        await setDoc(docRef, {
          ...newItem,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("Saving offline. Firestore write failed or delayed.", error);
      }
    }
  };

  // Update Field Handler
  const handleUpdateField = async (itemId: string, field: keyof AgendaItem, value: any) => {
    // Smart throttling for keystrokes to keep undo history clean
    const isTextInput = field === 'title' || field === 'notes';
    const now = Date.now();
    const editKey = `${itemId}_${field}`;
    
    if (!isTextInput || editKey !== lastEditedItemAndField.current || now - lastHistoryPushTime.current > 3000) {
      pushToHistory(items);
      lastHistoryPushTime.current = now;
      lastEditedItemAndField.current = editKey;
    }

    let updatePayload: Partial<AgendaItem> = { [field]: value };
    
    // Automatically calculate week when date changes
    if (field === 'date' && typeof value === 'string') {
      const calculatedSemana = getWeekNumber(value);
      updatePayload.semana = calculatedSemana;
    }

    // Handle exclusive toggling for coherence status
    if (field === 'coerenteOk') {
      if (value === true) {
        updatePayload.incoerenteX = false;
      }
    } else if (field === 'incoerenteX') {
      if (value === true) {
        updatePayload.coerenteOk = false;
      }
    }

    const updated = items.map((item) => {
      if (item.id === itemId) {
        return { 
          ...item, 
          ...updatePayload, 
          updatedAt: new Date().toISOString() 
        };
      }
      return item;
    });

    setItems(updated);
    localStorage.setItem('notion_offline_cache', JSON.stringify(updated));

    // Real-time duplicate checking on edit
    if (field === 'title' || field === 'date') {
      const currentItem = items.find(i => i.id === itemId);
      if (currentItem) {
        const nextTitle = (field === 'title' ? value : currentItem.title) || '';
        const nextDate = (field === 'date' ? value : currentItem.date) || '';
        if (nextTitle.trim() && nextDate) {
          const cleanTitle = nextTitle.trim().toLowerCase();
          const isDup = items.some(item => 
            item.id !== itemId &&
            item.title && item.title.trim().toLowerCase() === cleanTitle &&
            item.date === nextDate
          );
          if (isDup) {
            setDuplicateToast({
              id: itemId,
              title: nextTitle,
              date: nextDate
            });
          }
        }
      }
    }

    if (selectedItem && selectedItem.id === itemId) {
      setSelectedItem({ ...selectedItem, ...updatePayload });
    }

    if (currentUser && currentUser.uid !== 'guest_user') {
      try {
        const docRef = doc(db, 'agendaItems', itemId);
        await updateDoc(docRef, {
          ...updatePayload,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("Working offline. Cached changes locally.", error);
      }
    }
  };

  // Reorder list handler (Drag & Drop support)
  const handleReorderItems = async (reorderedItems: AgendaItem[]) => {
    pushToHistory(items);

    const withNewOrder = reorderedItems.map((item, index) => ({
      ...item,
      orderIndex: index
    }));

    setItems(withNewOrder);
    localStorage.setItem('notion_offline_cache', JSON.stringify(withNewOrder));

    if (currentUser && currentUser.uid !== 'guest_user') {
      try {
        const promises = withNewOrder.map((item) => {
          const docRef = doc(db, 'agendaItems', item.id);
          return updateDoc(docRef, {
            orderIndex: item.orderIndex,
            updatedAt: serverTimestamp()
          });
        });
        await Promise.all(promises);
      } catch (error) {
        console.warn("Error updating order in Firestore", error);
      }
    }
  };

  // Delete Item Handler
  const handleDeleteItem = async (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteConfirmId(itemId);
  };

  const executeDeleteItem = async (itemId: string) => {
    pushToHistory(items);
    const filtered = items.filter((item) => item.id !== itemId);
    setItems(filtered);
    localStorage.setItem('notion_offline_cache', JSON.stringify(filtered));

    if (selectedItem && selectedItem.id === itemId) {
      setSelectedItem(null);
    }

    if (currentUser && currentUser.uid !== 'guest_user') {
      try {
        const docRef = doc(db, 'agendaItems', itemId);
        await deleteDoc(docRef);
      } catch (error) {
        console.warn("Working offline. Cached deletion locally.", error);
      }
    }
    setDeleteConfirmId(null);
  };

  // Checklist utilities
  const handleAddTask = () => {
    if (!selectedItem || !newTaskText.trim()) return;

    const newTask: Task = {
      id: 'task_' + Date.now().toString(36),
      text: newTaskText.trim(),
      completed: false
    };

    const updatedTasks = [...(selectedItem.tasks || []), newTask];
    handleUpdateField(selectedItem.id, 'tasks', updatedTasks);
    setNewTaskText('');
  };

  const handleToggleTask = (taskId: string) => {
    if (!selectedItem) return;

    const updatedTasks = selectedItem.tasks.map((task) => {
      if (task.id === taskId) {
        return { ...task, completed: !task.completed };
      }
      return task;
    });

    handleUpdateField(selectedItem.id, 'tasks', updatedTasks);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!selectedItem) return;

    const updatedTasks = selectedItem.tasks.filter((task) => task.id !== taskId);
    handleUpdateField(selectedItem.id, 'tasks', updatedTasks);
  };

  // Handle Photo uploading convert to Base64 (perfect offline support)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedItem) return;

    (Array.from(files) as File[]).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const updatedPhotos = [...(selectedItem.photos || []), base64String];
        handleUpdateField(selectedItem.id, 'photos', updatedPhotos);
      };
      reader.readAsDataURL(file);
    });
  };
  // Screen Shot print download
  const handleCaptureScreen = () => {
    if (!containerRef.current) return;
    
    // Temporarily hide actions button from capturing if any
    const captureButton = document.getElementById('capture-btn');
    if (captureButton) captureButton.style.display = 'none';

    html2canvas(containerRef.current, {
      backgroundColor: '#FBFBFA',
      logging: false,
      useCORS: true,
      scale: 2 // High quality retina scale
    }).then((canvas) => {
      const link = document.createElement('a');
      link.download = `agenda_notion_${activeTab}_print.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      if (captureButton) captureButton.style.display = 'flex';
    }).catch((err) => {
      console.error("Failed capturing screenshot", err);
      if (captureButton) captureButton.style.display = 'flex';
    });
  };

  // Copy shared public url item to clipboard
  const handleCopySharedLink = (itemId: string) => {
    const rawUrl = `${window.location.origin}${window.location.pathname}?item=${itemId}`;
    navigator.clipboard.writeText(rawUrl)
      .then(() => alert('Link de compartilhamento copiado com sucesso! Compartilhe com qualquer pessoa!'))
      .catch((e) => console.error("Error copying link", e));
  };

  // Close public shared view
  const handleClosePublicSharedView = () => {
    setPublicItem(null);
    window.history.pushState({}, document.title, window.location.pathname);
  };

  if (authLoading || publicLoading) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex flex-col items-center justify-center text-[#37352F] gap-3 font-sans">
        <Clock size={32} className="animate-spin text-zinc-500" />
        <span className="text-xs font-mono tracking-wider">CARREGANDO NOTION DATABASES...</span>
      </div>
    );
  }

  // PUBLIC SHARED DETAIL PAGE VIEWER (if parameter ?item= is present)
  if (publicItem) {
    const statusLabel: Record<StatusType, string> = {
      'PROGRAMADO': 'PROGRAMADO 🔵',
      'REPROGRAMADO': 'REPROGRAMADO 🟣',
      'CONCLUIDO': 'CONCLUÍDO 🟢',
      'PENDENTE': 'PENDENTE 🟡'
    };

    return (
      <div className="min-h-screen bg-[#FBFBFA] text-[#37352F] p-4 md:p-8 font-sans">
        <div className="max-w-2xl mx-auto bg-white border border-[#EDEDEB] rounded-xl p-6 shadow-xl relative">
          <button 
            onClick={handleClosePublicSharedView}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#EBEBE9] text-[#A4A4A2] hover:text-[#37352F] transition-colors"
            title="Voltar para meu cronograma"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-emerald-600 tracking-wider mb-2">
            <Globe size={12} />
            <span>Agenda Pública Compartilhada</span>
          </div>

          <h1 className="text-xl md:text-2xl font-bold font-sans text-[#37352F] mb-6 border-b border-[#EDEDEB] pb-4">
            {publicItem.title}
          </h1>

          {/* Properties Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F7F7F5] p-4 rounded-lg border border-[#EDEDEB] mb-6">
            <div>
              <span className="text-[10px] text-[#A4A4A2] block uppercase font-bold tracking-wider">Semana</span>
              <span className="text-sm font-semibold font-mono text-[#37352F]"># {publicItem.semana}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#A4A4A2] block uppercase font-bold tracking-wider">Data Programada</span>
              <span className="text-sm text-[#37352F] font-medium">
                {new Date(publicItem.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#A4A4A2] block uppercase font-bold tracking-wider">Status de Progresso</span>
              <span className="inline-block px-2 py-0.5 mt-1 rounded text-xs font-semibold uppercase bg-[#EBEBE9] text-[#37352F]">
                {statusLabel[normalizeStatus(publicItem.status)]}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#A4A4A2] block uppercase font-bold tracking-wider">Prioridade</span>
              <span className="text-xs font-semibold text-[#37352F] mt-1 block">
                {publicItem.priority === 'Alta' && 'Alta Prioridade 🔴'}
                {publicItem.priority === 'Media' && 'Média Prioridade 🟡'}
                {publicItem.priority === 'Baixa' && 'Baixa Prioridade ⚪'}
              </span>
            </div>
            {publicItem.quant !== null && (
              <div className="sm:col-span-2">
                <span className="text-[10px] text-[#A4A4A2] block uppercase font-bold tracking-wider">Quantidade (QUANT)</span>
                <span className="text-sm font-semibold font-mono text-[#37352F]">{publicItem.quant}</span>
              </div>
            )}
          </div>

          {/* Note / Details */}
          {publicItem.notes && (
            <div className="mb-6">
              <span className="text-[10px] text-[#A4A4A2] block uppercase font-bold tracking-wider mb-1">Notas / Detalhes</span>
              <div className="bg-[#F7F7F5]/55 border border-[#EDEDEB] p-3 rounded text-sm text-[#37352F] whitespace-pre-line leading-relaxed">
                {publicItem.notes}
              </div>
            </div>
          )}

          {/* Tasks Checklist */}
          {publicItem.tasks && publicItem.tasks.length > 0 && (
            <div className="mb-6">
              <span className="text-[10px] text-[#A4A4A2] block uppercase font-bold tracking-wider mb-2">Checklist de Tarefas</span>
              <div className="space-y-2">
                {publicItem.tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2.5 bg-[#F7F7F5]/50 p-2 rounded border border-[#EDEDEB]/50">
                    <span className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center text-[10px] shrink-0 ${
                      task.completed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-[#EDEDEB] bg-white text-[#37352F]'
                    }`}>
                      {task.completed && <Check size={11} />}
                    </span>
                    <span className={`text-sm ${task.completed ? 'line-through text-[#A4A4A2]' : 'text-[#37352F]'}`}>
                      {task.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          {publicItem.photos && publicItem.photos.length > 0 && (
            <div>
              <span className="text-[10px] text-[#A4A4A2] block uppercase font-bold tracking-wider mb-2.5">Fotos Anexadas</span>
              <div className="grid grid-cols-2 gap-2">
                {publicItem.photos.map((photo, i) => (
                  <div key={i} className="aspect-video bg-[#F7F7F5] rounded border border-[#EDEDEB] overflow-hidden relative group">
                    <img src={photo} alt="Anexo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center mt-8 border-t border-[#EDEDEB] pt-4">
            <button 
              onClick={handleClosePublicSharedView}
              className="text-xs text-blue-600 hover:text-blue-500 hover:underline inline-flex items-center gap-1 font-medium"
            >
              Criar minha própria agenda style Notion gratis →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // UN-AUTHENTICATED LOGIN SCREEN (Notion Intro Style)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] text-[#37352F] font-sans flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
        {/* Ambient background decoration */}
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-white border border-[#EDEDEB] rounded-2xl p-8 relative flex flex-col items-center shadow-xl">
          {/* Logo container with stylish lightning bolt emoji */}
          <div className="w-20 h-20 bg-amber-50 rounded-full border border-amber-200 flex items-center justify-center shadow-xs mb-5 text-4xl select-none animate-bounce">
            ⚡
          </div>

          <h1 className="text-xl font-extrabold text-[#37352F] text-center tracking-tight mb-6 uppercase">
            Manutenção Goiânia RD
          </h1>

          <div className="w-full space-y-4 mb-8 bg-[#F7F7F5] p-4 rounded-lg border border-[#EDEDEB] text-left text-xs text-[#37352F]">
            <div className="flex items-start gap-2.5">
              <Check className="text-emerald-600 shrink-0 mt-0.5" size={14} />
              <span>Controle de programação</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Check className="text-emerald-600 shrink-0 mt-0.5" size={14} />
              <span>Gráfico de desempenho</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Check className="text-emerald-600 shrink-0 mt-0.5" size={14} />
              <span>Agenda semanal</span>
            </div>
          </div>

          {authError && (
            <div className="w-full p-4 mb-5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs leading-relaxed flex items-start gap-3 shadow-inner">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wider text-[10px] text-red-700 mb-1">Erro de Autenticação</p>
                <span>{authError}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full py-3 bg-[#37352F] hover:bg-[#2c2a26] text-white font-[#37352F] font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2.5 shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <LogIn size={16} />
            <span>Entrar com Conta do Google</span>
          </button>

          <div className="relative flex py-2 items-center w-full my-1">
            <div className="flex-grow border-t border-[#EDEDEB]"></div>
            <span className="flex-shrink mx-4 text-[10px] text-[#A4A4A2] font-semibold uppercase tracking-wider">ou</span>
            <div className="flex-grow border-t border-[#EDEDEB]"></div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCurrentUser({
                uid: "guest_user",
                email: "souzaleonardo005@gmail.com",
                displayName: "Leonardo Neres (Temporário)",
                photoURL: null
              } as any);
              setAuthLoading(false);
            }}
            className="w-full py-3 border border-[#EDEDEB] hover:bg-[#F7F7F5] bg-white text-[#37352F] font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2.5 shadow-xs hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <WifiOff size={16} className="text-amber-500" />
            <span>Continuar em Modo Convidado (Offline)</span>
          </button>

          <div className="text-center font-mono opacity-40 text-[9px] mt-6 tracking-wider text-[#A4A4A2]">
            CRIADOR DO SISTEMA - LEONARDO NERES
          </div>
        </div>
      </div>
    );
  }

  // Filter items in real time based on search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const queryStr = searchQuery.toLowerCase();
    
    const titleMatch = (item.title || '').toLowerCase().includes(queryStr);
    const semanaMatch = item.semana?.toString().includes(queryStr) || `semana ${item.semana}`.toLowerCase().includes(queryStr);
    const statusMatch = (item.status || '').toLowerCase().includes(queryStr);
    const priorityMatch = (item.priority || '').toLowerCase().includes(queryStr);
    const notesMatch = (item.notes || '').toLowerCase().includes(queryStr);
    const dateMatch = (item.date || '').toLowerCase().includes(queryStr);
    const tasksMatch = (item.tasks || []).some(
      (t) => (t.text || '').toLowerCase().includes(queryStr)
    );
    
    return titleMatch || semanaMatch || statusMatch || priorityMatch || notesMatch || dateMatch || tasksMatch;
  });

  // MAIN SYSTEM UI
  return (
    <div className="min-h-screen bg-[#FBFBFA] dark:bg-[#191919] text-[#37352F] dark:text-[#E3E3E2] font-sans flex select-none transition-colors duration-200" ref={containerRef}>
      
      {/* Sidebar Navigation - High Density Notion Theme style */}
      <aside className="hidden md:flex w-64 bg-[#F7F7F5] dark:bg-[#121212] border-r border-[#EDEDEB] dark:border-[#2C2C2C] flex-col shrink-0 transition-colors duration-200">
        <div className="p-3.5 flex items-center space-x-2 border-b border-[#EDEDEB] dark:border-[#2C2C2C]">
          <div className="w-8 h-8 bg-amber-50 dark:bg-amber-950/20 rounded-full border border-amber-200 dark:border-amber-900/40 flex items-center justify-center shrink-0 text-base shadow-xs select-none">
            ⚡
          </div>
          <span className="font-extrabold text-[12px] uppercase tracking-tight text-[#37352F] dark:text-[#E3E3E2] truncate">Manutenção Goiânia RD</span>
        </div>
        
        {/* Navigation block */}
        <nav className="flex-1 p-3 space-y-1">
          <div className="text-[10px] font-bold text-[#A4A4A2] dark:text-[#6E6E6C] px-2 mb-2 uppercase tracking-wider">Visualizações</div>
          
          <div 
            onClick={() => setActiveTab('table')}
            className={`flex items-center space-x-2.5 p-2 rounded cursor-pointer transition-all duration-150 ${
              activeTab === 'table' 
                ? 'bg-[#EBEBE9] dark:bg-[#202020] font-semibold text-[#37352F] dark:text-white' 
                : 'hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C] text-[#5A5A57] dark:text-[#8E8E8D]'
            }`}
          >
            <span className="text-xs">🗒️</span>
            <span className="text-[13px]">Cronograma</span>
          </div>

          <div 
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center space-x-2.5 p-2 rounded cursor-pointer transition-all duration-150 ${
              activeTab === 'calendar' 
                ? 'bg-[#EBEBE9] dark:bg-[#202020] font-semibold text-[#37352F] dark:text-white' 
                : 'hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C] text-[#5A5A57] dark:text-[#8E8E8D]'
            }`}
          >
            <span className="text-xs">📅</span>
            <span className="text-[13px]">Calendário</span>
          </div>

          <div 
            onClick={() => setActiveTab('charts')}
            className={`flex items-center space-x-2.5 p-2 rounded cursor-pointer transition-all duration-150 ${
              activeTab === 'charts' 
                ? 'bg-[#EBEBE9] dark:bg-[#202020] font-semibold text-[#37352F] dark:text-white' 
                : 'hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C] text-[#5A5A57] dark:text-[#8E8E8D]'
            }`}
          >
            <span className="text-xs">📊</span>
            <span className="text-[13px]">Estatísticas</span>
          </div>

          <div className="mt-6 pt-4 border-t border-[#EDEDEB] dark:border-[#2C2C2C]">
            <div className="text-[10px] font-bold text-[#A4A4A2] dark:text-[#6E6E6C] px-2 mb-2 uppercase tracking-wider font-sans">Ações Rápidas</div>
            
            <button
              onClick={() => handleAddItem()}
              className="w-full flex items-center space-x-2.5 p-2 rounded cursor-pointer hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C] text-[#5A5A57] dark:text-[#8E8E8D] transition-all text-left"
            >
              <span className="text-xs">➕</span>
              <span className="text-[13px]">Nova Atividade</span>
            </button>

            <button
              onClick={handleCaptureScreen}
              className="w-full flex items-center space-x-2.5 p-2 rounded cursor-pointer hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C] text-[#5A5A57] dark:text-[#8E8E8D] transition-all text-left"
            >
              <span className="text-xs">📷</span>
              <span className="text-[13px]">Capturar Tela</span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer with system status */}
        <div className="p-4 border-t border-[#EDEDEB] dark:border-[#2C2C2C] flex flex-col space-y-1 bg-[#F7F7F5] dark:bg-[#121212] transition-colors duration-200">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${!isOffline ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
            <span className="text-[11px] text-[#A4A4A2] dark:text-[#6E6E6C] font-semibold">
              {!isOffline ? 'Offline Sync Ativo' : 'Offline Mode'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#191919]">
        
        {/* Top Header Bar */}
        <header className="h-12 border-b border-[#EDEDEB] dark:border-[#2C2C2C] flex items-center justify-between px-6 bg-white dark:bg-[#1C1C1C] shrink-0">
          <div className="flex items-center space-x-4">
            <h1 className="text-sm font-semibold text-[#37352F] dark:text-[#E3E3E2] flex items-center gap-1.5">
              <span>Agenda Diária</span>
              <span className="text-[#A4A4A2] dark:text-[#5A5A57]">•</span>
              <span className="text-[#A4A4A2] dark:text-[#8E8E8D] font-medium">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
            </h1>

            {/* Mobile layout tabs toggle */}
            <div className="flex md:hidden bg-[#F1F1EF] dark:bg-[#2C2C2C] rounded p-0.5">
              <button 
                onClick={() => setActiveTab('table')}
                className={`px-3 py-0.5 text-[11px] rounded transition-all leading-tight ${activeTab === 'table' ? 'bg-white dark:bg-[#202020] shadow-xs font-semibold text-[#37352F] dark:text-white' : 'text-[#A4A4A2] dark:text-[#8E8E8D]'}`}
              >
                Tabela
              </button>
              <button 
                onClick={() => setActiveTab('calendar')}
                className={`px-3 py-0.5 text-[11px] rounded transition-all leading-tight ${activeTab === 'calendar' ? 'bg-white dark:bg-[#202020] shadow-xs font-semibold text-[#37352F] dark:text-white' : 'text-[#A4A4A2] dark:text-[#8E8E8D]'}`}
              >
                Calendário
              </button>
              <button 
                onClick={() => setActiveTab('charts')}
                className={`px-3 py-0.5 text-[11px] rounded transition-all leading-tight ${activeTab === 'charts' ? 'bg-white dark:bg-[#202020] shadow-xs font-semibold text-[#37352F] dark:text-white' : 'text-[#A4A4A2] dark:text-[#8E8E8D]'}`}
              >
                Gráficos
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Header Toolbar: Undo, Redo, Theme, Clean-up */}
            <div className="flex items-center gap-1 bg-[#F1F1EF] dark:bg-[#202020] p-0.5 rounded border border-[#EDEDEB] dark:border-[#2C2C2C] shrink-0">
              {/* Undo Button */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0}
                className={`p-1 rounded transition-colors flex items-center justify-center ${
                  history.length > 0
                    ? 'text-[#37352F] dark:text-[#E3E3E2] hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C]'
                    : 'text-[#A4A4A2] dark:text-[#5A5A57] opacity-40 cursor-not-allowed'
                }`}
                title="Desfazer (Ctrl+Z)"
              >
                <Undo2 size={13} />
              </button>

              {/* Redo Button */}
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className={`p-1 rounded transition-colors flex items-center justify-center ${
                  redoStack.length > 0
                    ? 'text-[#37352F] dark:text-[#E3E3E2] hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C]'
                    : 'text-[#A4A4A2] dark:text-[#5A5A57] opacity-40 cursor-not-allowed'
                }`}
                title="Refazer (Ctrl+Y)"
              >
                <Redo2 size={13} />
              </button>

              <div className="h-3.5 w-px bg-[#EDEDEB] dark:bg-[#2C2C2C] mx-0.5"></div>

              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-1 rounded text-[#37352F] dark:text-[#E3E3E2] hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C] transition-colors flex items-center justify-center"
                title={theme === 'light' ? 'Mudar para Tema Escuro' : 'Mudar para Tema Claro'}
              >
                {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
              </button>

              <div className="h-3.5 w-px bg-[#EDEDEB] dark:bg-[#2C2C2C] mx-0.5"></div>

              {/* Clear All Data Button */}
              <button
                type="button"
                onClick={() => setClearDataConfirm(true)}
                className="p-1 rounded text-[#C12E2A] hover:bg-[#FFE2DD]/60 dark:hover:bg-[#FFE2DD]/15 hover:text-red-500 transition-all flex items-center justify-center"
                title="Limpar todos os dados definitivamente"
              >
                <span className="text-[10px] font-bold px-1 select-none">LIMPAR</span>
              </button>
            </div>

            <span className="text-[12px] text-[#A4A4A2] hidden lg:inline">Atualizado agora</span>
            
            {/* Profile widget bar */}
            <div className="flex items-center space-x-2">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt="Avatar" 
                  className="w-7 h-7 rounded-full border border-white shadow-sm shrink-0" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#D3E3FD] text-[#0B57D0] flex items-center justify-center text-xs border border-white shadow-sm font-bold shrink-0">
                  U
                </div>
              )}
              <span className="text-[12px] font-semibold text-[#37352F] font-mono hidden md:inline max-w-[120px] truncate">
                {currentUser.email?.split('@')[0]}
              </span>
              <button
                onClick={handleLogout}
                title="Sair da conta"
                className="p-1 px-2 text-xs text-[#A4A4A2] hover:text-[#C12E2A] hover:bg-[#FFE2DD]/40 rounded transition-colors flex items-center gap-1 shrink-0"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        {/* Global Offline Info notification */}
        {isOffline && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-[11px] py-2 px-6 flex items-center gap-2 font-mono">
            <WifiOff size={13} className="animate-pulse text-amber-600" />
            <span>MODO OFFLINE ATIVO - Suas alterações estão salvas localmente e sincronizarão com o banco assim que restabelecido.</span>
          </div>
        )}

        {/* Content area */}
        <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-6 bg-[#FFFFFF] dark:bg-[#191919]">
          {/* Dashboard Header Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F1EF] dark:border-[#2C2C2C] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/20 rounded-full border border-amber-200 dark:border-amber-900/45 flex items-center justify-center shrink-0 shadow-xs text-2xl select-none animate-fade-in">
                ⚡
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-[#37352F] dark:text-[#E3E3E2] uppercase">
                  Manutenção Goiânia RD
                </h2>
                <p className="text-[10px] text-[#A4A4A2] dark:text-[#8E8E8D] mt-0.5 uppercase font-bold tracking-wider">
                  Controle check-in/check-up
                </p>
              </div>
            </div>

            {/* Quick action buttons in title area */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="capture-btn"
                onClick={handleCaptureScreen}
                className="px-3 py-1.5 border border-[#EDEDEB] dark:border-[#2C2C2C] hover:bg-[#F7F7F5] dark:hover:bg-[#2A2A2A] bg-white dark:bg-[#1E1E1E] text-[#37352F] dark:text-[#E3E3E2] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Baixar imagem como screenshot"
              >
                <Download size={13} />
                <span>Capturar Tela</span>
              </button>

              {/* Import Excel Button */}
              <button
                type="button"
                onClick={handleImportExcelClick}
                className="px-3 py-1.5 border border-[#EDEDEB] dark:border-[#2C2C2C] hover:bg-[#F7F7F5] dark:hover:bg-[#2A2A2A] bg-white dark:bg-[#1E1E1E] text-[#37352F] dark:text-[#E3E3E2] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Importar cronograma de planilha do Excel (.xlsx)"
                id="excel-import-btn"
              >
                <Upload size={13} className="text-emerald-500 dark:text-emerald-400" />
                <span>Importar Excel</span>
              </button>

              {/* Export Excel Button */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-1.5 border border-[#EDEDEB] dark:border-[#2C2C2C] hover:bg-[#F7F7F5] dark:hover:bg-[#2A2A2A] bg-white dark:bg-[#1E1E1E] text-[#37352F] dark:text-[#E3E3E2] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Exportar todo o cronograma para planilha do Excel (.xlsx)"
                id="excel-export-btn"
              >
                <DownloadCloud size={13} className="text-sky-500 dark:text-sky-450" />
                <span>Exportar Excel</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddItem()}
                className="px-3 py-1.5 bg-[#37352F] dark:bg-[#E3E1DE] hover:bg-[#2c2a26] dark:hover:bg-white text-white dark:text-[#121212] font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={13} />
                <span>Nova Atividade</span>
              </button>
            </div>
          </div>

          {/* Search Bar - Notion Inspired */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A4A4A2] dark:text-[#5A5A57]">
              <Search size={15} />
            </div>
            <input
              type="text"
              placeholder="Pesquisar por título, semana, status, prioridade, checklist ou notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#F7F7F5] dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] hover:border-zinc-300 dark:hover:border-zinc-650 focus:border-[#C1C1BF] dark:focus:border-[#5C5C59] focus:bg-white dark:focus:bg-[#1E1E1E] rounded-lg text-xs outline-none transition-all placeholder-[#A4A4A2] dark:placeholder-[#6E6E6C] text-[#37352F] dark:text-[#E3E3E2] shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#A4A4A2] hover:text-[#C12E2A] text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Dynamic inner tab layout rendered here */}
          <div className="transition-all duration-300">
            {activeTab === 'table' && (
              <TableView 
                items={filteredItems}
                columns={columns}
                onUpdateColumns={setColumns}
                onSelectItem={setSelectedItem}
                onAddItem={handleAddItem}
                onDeleteItem={handleDeleteItem}
                onUpdateField={handleUpdateField}
                onReorderItems={handleReorderItems}
                currentUserId={currentUser.uid}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView 
                items={filteredItems}
                onSelectItem={setSelectedItem}
                onAddItem={handleAddItem}
              />
            )}

            {activeTab === 'charts' && (
              <ChartView items={filteredItems} />
            )}
          </div>
        </div>

      </main>

      {/* CUSTOM CONFIRM DELETION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[999] flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-lg border border-[#EDEDEB] dark:border-[#2C2C2C] shadow-2xl p-6 max-w-sm w-full text-center text-[#37352F] dark:text-[#E3E3E2] font-sans antialiased animate-scale-up">
            <h3 className="text-sm font-bold text-[#37352F] dark:text-[#E3E3E2] mb-2 uppercase tracking-wide">Confirmar Exclusão</h3>
            <p className="text-xs text-[#5A5A57] dark:text-[#A4A4A2] mb-6">
              Deseja realmente excluir esta página permanentemente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-1.5 rounded bg-[#F1F1EF] dark:bg-[#2C2C2C] hover:bg-[#EBEBE9] dark:hover:bg-[#333333] text-[#5A5A57] dark:text-[#A4A4A2] text-xs font-bold transition-all border border-[#EDEDEB] dark:border-[#383838] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => executeDeleteItem(deleteConfirmId)}
                className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM CLEAR ALL DATA MODAL */}
      {clearDataConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[999] flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-lg border border-[#EDEDEB] dark:border-[#2C2C2C] shadow-2xl p-6 max-w-sm w-full text-center text-[#37352F] dark:text-[#E3E3E2] font-sans antialiased animate-scale-up">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 mb-4 select-none animate-bounce text-xl">
              ⚠️
            </div>
            <h3 className="text-sm font-bold text-[#37352F] dark:text-[#E3E3E2] mb-2 uppercase tracking-wide">Limpar Todos os Dados?</h3>
            <p className="text-xs text-[#5A5A57] dark:text-[#A4A4A2] mb-6 leading-relaxed">
              Deseja realmente apagar <span className="font-bold">todas as atividades</span> deste cronograma? Esta alteração pode ser desfeita usando Desfazer no menu superior.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setClearDataConfirm(false)}
                className="px-4 py-1.5 rounded bg-[#F1F1EF] dark:bg-[#2C2C2C] hover:bg-[#EBEBE9] dark:hover:bg-[#333333] text-[#5A5A57] dark:text-[#A4A4A2] text-xs font-bold transition-all border border-[#EDEDEB] dark:border-[#383838] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Limpar Tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED NOTION SIDEBAR SIDE-DRAWER / MODAL COLLAPSIBLE */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-end animate-fade-in select-none">
          <div className="w-full max-w-lg h-full bg-white dark:bg-[#1C1C1C] border-l border-[#EDEDEB] dark:border-[#2C2C2C] flex flex-col p-6 shadow-2xl relative animate-slide-left text-[#37352F] dark:text-[#E3E3E2] transition-colors duration-200">
            
            {/* Top Toolbar */}
            <div className="flex items-center justify-between pb-4 border-b border-[#EDEDEB] dark:border-[#2C2C2C] mb-5">
              <div className="flex items-center gap-4">
                {/* Share module */}
                <button
                  type="button"
                  onClick={() => handleUpdateField(selectedItem.id, 'isPublic', !selectedItem.isPublic)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all ${
                    selectedItem.isPublic 
                      ? 'bg-[#DBEDDB] dark:bg-[#1E301F] text-[#1C5E28] dark:text-[#A1DBA8] border border-transparent' 
                      : 'bg-[#EDEDEB] dark:bg-[#2C2C2C] text-[#5A5A57] dark:text-[#8E8E8D] border border-transparent'
                  }`}
                  title="Compartilhar publicamente como página web permanente"
                >
                  {selectedItem.isPublic ? <Globe size={11} /> : <Lock size={11} />}
                  <span>{selectedItem.isPublic ? 'Público (Compartilhado)' : 'Privado'}</span>
                </button>

                {selectedItem.isPublic && (
                  <button
                    type="button"
                    onClick={() => handleCopySharedLink(selectedItem.id)}
                    className="p-1 hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C] rounded text-[#37352F] dark:text-[#E3E3E2] transition-colors"
                    title="Copiar link de compartilhamento"
                  >
                    <Share2 size={13} />
                  </button>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 px-1.5 hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C] text-[#37352F] dark:text-[#E3E3E2] rounded-full transition-colors"
                title="Fechar detalhes"
              >
                <X size={16} />
              </button>
            </div>

            {/* Sidebar properties scroll content */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-thin">
              {/* Page Title */}
              <div>
                <input
                  type="text"
                  value={selectedItem.title}
                  onChange={(e) => handleUpdateField(selectedItem.id, 'title', e.target.value)}
                  placeholder="Atividade Sem Título"
                  className="w-full bg-transparent border-none text-xl font-bold text-[#37352F] dark:text-[#E3E3E2] outline-none placeholder-[#A4A4A2] dark:placeholder-[#5A5A57] p-0 focus:ring-0"
                />
                {(() => {
                  if (!selectedItem.title || !selectedItem.title.trim() || !selectedItem.date) return null;
                  const cleanTitle = selectedItem.title.trim().toLowerCase();
                  const isDuplicate = items.some(item => 
                    item.id !== selectedItem.id &&
                    item.title && item.title.trim().toLowerCase() === cleanTitle &&
                    item.date === selectedItem.date
                  );
                  if (isDuplicate) {
                    return (
                      <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-lg flex items-start gap-2 text-[#37352F] dark:text-amber-100 animate-fade-in font-sans">
                        <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-normal">
                          <span className="font-bold text-amber-800 dark:text-amber-400">Alerta de Linha Duplicada:</span>
                          <p className="mt-0.5 text-[#5A5A57] dark:text-[#A4A4A2]">
                            Já existe outra atividade cadastrada com o título <span className="font-semibold text-[#37352F] dark:text-white">"{selectedItem.title}"</span> para a data de <span className="font-semibold text-[#37352F] dark:text-white">{
                              (() => {
                                const parts = selectedItem.date.split('-');
                                if (parts.length !== 3) return selectedItem.date;
                                return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
                              })()
                            }</span>.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Grid properties properties block */}
              <div className="space-y-3 bg-[#F7F7F5] dark:bg-[#202020] p-3 rounded-lg border border-[#EDEDEB] dark:border-[#2C2C2C] text-xs text-[#37352F] dark:text-[#E3E3E2] transition-colors">
                {/* 1. DATE */}
                <div className="grid grid-cols-3 items-center">
                  <span className="text-[#A4A4A2] dark:text-[#6E6E6C] font-semibold uppercase tracking-wider text-[10px]">Data</span>
                  <div className="col-span-2">
                    <input
                      type="date"
                      value={selectedItem.date}
                      onChange={(e) => handleUpdateField(selectedItem.id, 'date', e.target.value)}
                      className="bg-transparent border-0 outline-none w-full text-[#37352F] dark:text-[#E3E3E2] font-sans cursor-pointer font-medium"
                    />
                  </div>
                </div>

                {/* 2. SECTOR / WEEK */}
                <div className="grid grid-cols-3 items-center">
                  <span className="text-[#A4A4A2] dark:text-[#6E6E6C] font-semibold uppercase tracking-wider text-[10px]">Semana</span>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={selectedItem.semana || ''}
                      onChange={(e) => handleUpdateField(selectedItem.id, 'semana', Number(e.target.value))}
                      className="bg-transparent border-0 outline-none w-full font-mono text-[#37352F] dark:text-[#E3E3E2]"
                    />
                  </div>
                </div>

                {/* 3. STATUS */}
                <div className="grid grid-cols-3 items-center">
                  <span className="text-[#A4A4A2] dark:text-[#6E6E6C] font-semibold uppercase tracking-wider text-[10px]">Status</span>
                  <div className="col-span-2">
                    <select
                      value={normalizeStatus(selectedItem.status)}
                      onChange={(e) => handleUpdateField(selectedItem.id, 'status', e.target.value)}
                      className="bg-transparent border-0 outline-none w-full font-semibold uppercase text-blue-600 dark:text-blue-400 cursor-pointer"
                    >
                      <option value="PROGRAMADO" className="dark:bg-[#2C2C2C]">PROGRAMADO</option>
                      <option value="REPROGRAMADO" className="dark:bg-[#2C2C2C]">REPROGRAMADO</option>
                      <option value="CONCLUIDO" className="dark:bg-[#2C2C2C]">CONCLUÍDO</option>
                      <option value="PENDENTE" className="dark:bg-[#2C2C2C]">PENDENTE</option>
                    </select>
                  </div>
                </div>

                {/* 4. PRIORITY */}
                <div className="grid grid-cols-3 items-center">
                  <span className="text-[#A4A4A2] dark:text-[#6E6E6C] font-semibold uppercase tracking-wider text-[10px]">Prioridade</span>
                  <div className="col-span-2">
                    <select
                      value={selectedItem.priority}
                      onChange={(e) => handleUpdateField(selectedItem.id, 'priority', e.target.value)}
                      className="bg-transparent border-0 outline-none w-full font-semibold text-orange-600 dark:text-orange-400 cursor-pointer"
                    >
                      <option value="Alta" className="dark:bg-[#2C2C2C]">Alta 🔴</option>
                      <option value="Media" className="dark:bg-[#2C2C2C]">Média 🟡</option>
                      <option value="Baixa" className="dark:bg-[#2C2C2C]">Baixa ⚪</option>
                    </select>
                  </div>
                </div>

                {/* 5. QUANT */}
                <div className="grid grid-cols-3 items-center">
                  <span className="text-[#A4A4A2] dark:text-[#6E6E6C] font-semibold uppercase tracking-wider text-[10px]">Quantidade (# QUANT)</span>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={selectedItem.quant !== null && selectedItem.quant !== undefined ? selectedItem.quant : ''}
                      onChange={(e) => handleUpdateField(selectedItem.id, 'quant', e.target.value ? Number(e.target.value) : null)}
                      placeholder="—"
                      className="bg-transparent border-0 outline-none w-full text-[#37352F] dark:text-[#E3E3E2] font-mono"
                    />
                  </div>
                </div>

                {/* 6. COERÊNCIA (OK / X) */}
                <div className="grid grid-cols-3 items-center pt-1">
                  <span className="text-[#A4A4A2] dark:text-[#6E6E6C] font-semibold uppercase tracking-wider text-[10px]">Coerência</span>
                  <div className="col-span-2 flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none hover:opacity-80 transition-opacity">
                      <input
                        type="checkbox"
                        checked={!!selectedItem.coerenteOk}
                        onChange={(e) => handleUpdateField(selectedItem.id, 'coerenteOk', e.target.checked)}
                        className="rounded border-[#EDEDEB] dark:border-[#383838] text-emerald-500 focus:ring-emerald-400 h-3.5 w-3.5 cursor-pointer accent-emerald-500"
                      />
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Coerente OK (🟢)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none hover:opacity-80 transition-opacity">
                      <input
                        type="checkbox"
                        checked={!!selectedItem.incoerenteX}
                        onChange={(e) => handleUpdateField(selectedItem.id, 'incoerenteX', e.target.checked)}
                        className="rounded border-[#EDEDEB] dark:border-[#383838] text-red-500 focus:ring-red-400 h-3.5 w-3.5 cursor-pointer accent-red-500"
                      />
                      <span className="text-[11px] font-bold text-red-650 dark:text-red-400">Incoerente (🔴 X)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Long text description / Notes */}
              <div>
                <label className="text-[10px] text-[#A4A4A2] dark:text-[#6E6E6C] block font-semibold mb-1 uppercase">Notas / Descrição Detalhada</label>
                <textarea
                  value={selectedItem.notes || ''}
                  onChange={(e) => handleUpdateField(selectedItem.id, 'notes', e.target.value)}
                  placeholder="Escreva anotações gerais estilo Notion..."
                  rows={4}
                  className="w-full bg-[#F7F7F5] dark:bg-[#202020] hover:bg-[#EBEBE9] dark:hover:bg-[#2A2A2A] border border-[#EDEDEB] dark:border-[#2C2C2C] focus:border-[#37352F] dark:focus:border-zinc-550 rounded p-2 text-xs text-[#37352F] dark:text-[#E3E3E2] outline-none resize-none transition-colors leading-relaxed"
                />
              </div>

              {/* Tasks Checklist */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1">
                  <CheckSquare size={14} className="text-[#A4A4A2] dark:text-[#6E6E6C]" />
                  <label className="text-[10px] text-[#A4A4A2] dark:text-[#6E6E6C] font-semibold uppercase">Lista de Tarefas</label>
                </div>

                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {selectedItem.tasks && selectedItem.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 group bg-[#F7F7F5] dark:bg-[#202020] py-1.5 px-2 rounded hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C] transition-colors font-sans dropdown-shadow-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] transition-colors ${
                          task.completed 
                            ? 'bg-green-600 border-green-500 text-white' 
                            : 'border-[#EDEDEB] dark:border-[#383838] hover:border-[#37352F] dark:hover:border-[#E3E3E2] bg-white dark:bg-[#2A2A2A]'
                        }`}
                      >
                        {task.completed && <Check size={11} />}
                      </button>
                      <span className={`text-xs flex-1 truncate ${task.completed ? 'line-through text-[#A4A4A2] dark:text-[#6E6E6C]' : 'text-[#37352F] dark:text-[#E3E3E2]'}`}>
                        {task.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-[#A4A4A2] dark:text-[#5A5A57] hover:text-red-500 transition-opacity"
                        title="Deletar tarefa"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}

                  {(!selectedItem.tasks || selectedItem.tasks.length === 0) && (
                    <p className="text-[11px] text-[#A4A4A2] dark:text-[#6E6E6C] italic text-center py-2">Nenhuma subtarefa criada.</p>
                  )}
                </div>

                {/* Add subtask */}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="Adicionar subtarefa ao checklist..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    className="flex-1 bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] focus:border-[#37352F] dark:focus:border-zinc-500 rounded px-2.5 py-1.5 text-xs text-[#37352F] dark:text-[#E3E3E2] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="p-1.5 bg-[#37352F] dark:bg-[#E3E3E2] hover:bg-[#2c2a26] dark:hover:bg-white text-white dark:text-[#121212] rounded transition-colors cursor-pointer"
                  >
                    <PlusCircle size={14} />
                  </button>
                </div>
              </div>

              {/* Subir Fotos Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Camera size={14} className="text-[#A4A4A2] dark:text-[#6E6E6C]" />
                    <label className="text-[10px] text-[#A4A4A2] dark:text-[#6E6E6C] font-semibold uppercase">Fotos e Imagens</label>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>Upload</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                {/* Drag and Drop preview photos indicator */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-[#EDEDEB] dark:border-[#2C2C2C] rounded-lg p-5 text-center cursor-pointer hover:border-[#37352F] dark:hover:border-white hover:bg-[#F7F7F5] dark:hover:bg-[#202020] transition-all"
                >
                  <Camera size={18} className="mx-auto text-[#A4A4A2] dark:text-[#6E6E6C] mb-1" />
                  <p className="text-[11px] text-[#A4A4A2] dark:text-[#6E6E6C] font-medium">Clique para selecionar fotos ou arraste as fotos aqui para salvar</p>
                </div>

                {/* Grid layout of active photo uploads */}
                {selectedItem.photos && selectedItem.photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {selectedItem.photos.map((photo, index) => (
                      <div key={index} className="aspect-video bg-[#F7F7F5] dark:bg-[#202020] rounded border border-[#EDEDEB] dark:border-[#2C2C2C] overflow-hidden relative group">
                        <img src={photo} alt={`Anexo ${index + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => {
                            const updatedPhotos = selectedItem.photos.filter((_, i) => i !== index);
                            handleUpdateField(selectedItem.id, 'photos', updatedPhotos);
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/85 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom properties save status */}
            <div className="mt-4 pt-4 border-t border-[#EDEDEB] dark:border-[#2C2C2C] flex items-center justify-between text-[11px] text-[#A4A4A2] dark:text-[#6E6E6C] font-mono">
              <span className="flex items-center gap-1.5 uppercase font-semibold">
                <AlertCircle size={12} className="text-[#A4A4A2] dark:text-[#6E6E6C]" />
                <span>Salvo local e na nuvem</span>
              </span>
              <span>ID: {selectedItem.id}</span>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING REAL-TIME DUPLICATE ALERT TOAST */}
      {duplicateToast && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full bg-[#18181B]/95 text-white p-4 rounded-xl shadow-2xl border border-zinc-800 flex items-start gap-3 animate-slide-up antialiased font-sans">
          <div className="p-1 px-1.5 bg-amber-500 rounded-lg text-black font-semibold shrink-0">
            <AlertTriangle size={15} />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-0.5">Linha Duplicada Detectada</h4>
            <p className="text-[11px] text-zinc-300 leading-normal">
              Já existe uma atividade cadastrada nesta data com o título: <span className="font-semibold text-white">"{duplicateToast.title}"</span>.
            </p>
          </div>
          <button 
            onClick={() => setDuplicateToast(null)}
            className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-800 rounded-full transition-colors shrink-0"
            title="Fechar aviso"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* HIDDEN EXCEL INPUT */}
      <input
        type="file"
        ref={excelInputRef}
        accept=".xlsx, .xls"
        onChange={handleImportExcelFileChange}
        className="hidden"
        id="excel-hidden-input"
      />

      {/* EXCEL IMPORTING OVERLAY PROGRESS LOADER */}
      {excelImportLoading && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-3xs flex flex-col items-center justify-center gap-3 animate-fade-in" id="excel-import-loader">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white"></div>
          <p className="text-white text-[10px] font-bold uppercase tracking-wider animate-pulse font-mono">Processando Arquivo Excel e Sincronizando Banco...</p>
        </div>
      )}

      {/* EXCEL SUCCESS/ERROR ALERT BANNER TOAST */}
      {excelMessage && (
        <div 
          className={`fixed bottom-6 left-6 z-[9999] max-w-sm w-full p-4 rounded-xl shadow-2xl border flex items-start gap-3 animate-slide-up antialiased font-sans ${
            excelMessage.isError 
              ? 'bg-red-50 border-red-200 text-red-900 dark:bg-red-955/95 dark:border-red-900/60 dark:text-red-100'
              : 'bg-emerald-50 border-emerald-250 text-emerald-900 dark:bg-emerald-955/95 dark:border-emerald-900/60 dark:text-emerald-100'
          }`}
          id="excel-msg-toast"
        >
          <div className={`p-1 px-1.5 rounded-lg text-white font-bold shrink-0 ${
            excelMessage.isError ? 'bg-red-500' : 'bg-emerald-500'
          }`}>
            {excelMessage.isError ? <AlertCircle size={14} /> : <Check size={14} />}
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold uppercase tracking-wide mb-0.5">
              {excelMessage.isError ? 'Erro na Planilha' : 'Planilha Importada'}
            </h4>
            <p className="text-[11px] leading-normal opacity-90">{excelMessage.text}</p>
          </div>
          <button 
            type="button"
            onClick={() => setExcelMessage(null)}
            className="opacity-70 hover:opacity-100 p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors shrink-0 cursor-pointer text-current"
            title="Fechar"
            id="excel-msg-close"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
