import React, { useState } from 'react';
import { AgendaItem, StatusType, PriorityType, normalizeStatus, ColumnConfig, DEFAULT_COLUMNS } from '../types';
import { 
  FileText, 
  Calendar as CalendarIcon, 
  Hash, 
  Tag, 
  Image as ImageIcon, 
  Trash2, 
  Plus, 
  MoreHorizontal,
  CheckCircle2,
  Lock,
  Globe,
  Share2,
  ExternalLink,
  Copy,
  GripVertical,
  Check,
  X,
  AlertTriangle,
  Sliders
} from 'lucide-react';

interface TableViewProps {
  items: AgendaItem[];
  columns: ColumnConfig[];
  onUpdateColumns: (cols: ColumnConfig[]) => void;
  onSelectItem: (item: AgendaItem) => void;
  onAddItem: (initialData?: Partial<AgendaItem>) => void;
  onDeleteItem: (id: string, e: React.MouseEvent) => void;
  onUpdateField: (id: string, field: keyof AgendaItem, value: any) => void;
  onReorderItems?: (reorderedItems: AgendaItem[]) => void;
  currentUserId: string;
}

export default function TableView({
  items,
  columns,
  onUpdateColumns,
  onSelectItem,
  onAddItem,
  onDeleteItem,
  onUpdateField,
  onReorderItems,
  currentUserId
}: TableViewProps) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  
  // Drag & drop state for row reordering
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // States for Column Editor Modal
  const [editingColumn, setEditingColumn] = useState<ColumnConfig | null>(null);
  const [tempColTitle, setTempColTitle] = useState('');
  const [tempColAlignment, setTempColAlignment] = useState<'left' | 'center' | 'right'>('left');
  const [tempColFormat, setTempColFormat] = useState<string>('default');
  const [tempColPrefix, setTempColPrefix] = useState('');
  const [tempColSuffix, setTempColSuffix] = useState('');
  const [tempColDecimals, setTempColDecimals] = useState<number>(0);

  const findCol = (id: string) => columns.find(c => c.id === id) || DEFAULT_COLUMNS.find(d => d.id === id)!;

  const getAlignClass = (align: 'left' | 'center' | 'right' | undefined) => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  const getAlignFlexClass = (align: 'left' | 'center' | 'right' | undefined) => {
    if (align === 'center') return 'justify-center';
    if (align === 'right') return 'justify-end';
    return 'justify-start';
  };

  // Dynamic formatting helpers based on User configurations
  const formatTitle = (title: string) => {
    const col = findCol('title');
    let text = title || "Página Sem Título";
    if (col.format === 'uppercase') text = text.toUpperCase();
    if (col.format === 'lowercase') text = text.toLowerCase();
    return `${col.prefix || ''}${text}${col.suffix || ''}`;
  };

  const formatDateValue = (dateStr: string) => {
    const col = findCol('date');
    const fmt = col?.format || 'default';
    if (!dateStr) return 'Sem data';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const date = new Date(year, month, day);

    if (isNaN(date.getTime())) return dateStr;

    if (fmt === 'iso') return dateStr;
    if (fmt === 'friendly_short') {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${String(day).padStart(2, '0')} ${months[month]}`;
    }
    if (fmt === 'friendly') {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${String(day).padStart(2, '0')} ${months[month]} ${year}`;
    }
    if (fmt === 'full') {
      const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      return `${weekdays[date.getDay()]}, ${day} de ${months[month]} de ${year}`;
    }
    // Default format: DD/MM/AAAA (keeping simple localized layout helper)
    return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
  };

  const formatSemanaValue = (semana: number) => {
    const col = findCol('semana');
    return `${col.prefix || ''}${semana}${col.suffix || ''}`;
  };

  const formatQuantValue = (quant: number | null | undefined) => {
    if (quant === null || quant === undefined) return '—';
    const col = findCol('quant');
    const places = col.decimalPlaces ?? 0;
    const formatted = Number(quant).toFixed(places);
    return `${col.prefix || ''}${formatted}${col.suffix || ''}`;
  };

  const formatPriorityValue = (prio: PriorityType) => {
    const col = findCol('priority');
    const fmt = col?.format || 'emoji_text';
    const priorityEmojis = {
      'Alta': '🔴',
      'Media': '🟡',
      'Baixa': '⚪'
    };
    if (fmt === 'emoji_only') return priorityEmojis[prio] || '';
    if (fmt === 'text_only') return prio;
    // emoji_text
    return `${priorityEmojis[prio] || ''} ${prio}`;
  };

  const openColOptions = (col: ColumnConfig) => {
    setEditingColumn(col);
    setTempColTitle(col.title);
    setTempColAlignment(col.alignment);
    setTempColFormat(col.format || 'default');
    setTempColPrefix(col.prefix || '');
    setTempColSuffix(col.suffix || '');
    setTempColDecimals(col.decimalPlaces ?? 0);
  };

  const handleSaveColumnOptions = () => {
    if (!editingColumn) return;
    const updated = columns.map(c => {
      if (c.id === editingColumn.id) {
        return {
          ...c,
          title: tempColTitle,
          alignment: tempColAlignment,
          format: tempColFormat as any,
          prefix: tempColPrefix,
          suffix: tempColSuffix,
          decimalPlaces: tempColDecimals
        };
      }
      return c;
    });
    onUpdateColumns(updated);
    setEditingColumn(null);
  };

  const handleResetColumnOptions = () => {
    if (!editingColumn) return;
    const defaultCol = DEFAULT_COLUMNS.find(d => d.id === editingColumn.id);
    if (defaultCol) {
      setTempColTitle(defaultCol.title);
      setTempColAlignment(defaultCol.alignment);
      setTempColFormat(defaultCol.format || 'default');
      setTempColPrefix(defaultCol.prefix || '');
      setTempColSuffix(defaultCol.suffix || '');
      setTempColDecimals(defaultCol.decimalPlaces ?? 0);
    }
  };

  // States for interactive column-level filtering (Filtros em cada coluna/título)
  const [colFilterTitle, setColFilterTitle] = useState('');
  const [colFilterDate, setColFilterDate] = useState('');
  const [colFilterSemana, setColFilterSemana] = useState('');
  const [colFilterStatus, setColFilterStatus] = useState('all');
  const [colFilterCoerence, setColFilterCoerence] = useState('all');
  const [colFilterPriority, setColFilterPriority] = useState('all');

  // Filter items dynamically based on column inputs
  const filteredDisplayItems = items.filter(item => {
    if (colFilterTitle.trim()) {
      const q = colFilterTitle.toLowerCase();
      if (!(item.title || '').toLowerCase().includes(q)) return false;
    }

    if (colFilterDate.trim()) {
      const q = colFilterDate.toLowerCase();
      const formatted = formatDateStr(item.date).toLowerCase();
      const raw = (item.date || '').toLowerCase();
      if (!formatted.includes(q) && !raw.includes(q)) return false;
    }

    if (colFilterSemana.trim()) {
      const s = item.semana !== undefined && item.semana !== null ? item.semana.toString() : '';
      if (!s.includes(colFilterSemana)) return false;
    }

    if (colFilterStatus !== 'all') {
      const norm = normalizeStatus(item.status);
      if (norm !== colFilterStatus) return false;
    }

    if (colFilterCoerence !== 'all') {
      if (colFilterCoerence === 'ok') {
        if (!item.coerenteOk) return false;
      } else if (colFilterCoerence === 'x') {
        if (!item.incoerenteX) return false;
      } else if (colFilterCoerence === 'none') {
        if (item.coerenteOk || item.incoerenteX) return false;
      }
    }

    if (colFilterPriority !== 'all') {
      if (item.priority !== colFilterPriority) return false;
    }

    return true;
  });

  // Calculate sum of quantities for visible items under the QUANT column
  const totalQuantity = filteredDisplayItems.reduce((acc, item) => acc + Number(item.quant || 0), 0);

  // Identify duplicate items (same title and date, with different IDs)
  const duplicateItemIds = new Set<string>();
  items.forEach(a => {
    if (!a.title || !a.title.trim() || !a.date) return;
    const cleanTitle = a.title.trim().toLowerCase();
    const hasDuplicate = items.some(b => 
      b.id !== a.id &&
      b.title && b.title.trim().toLowerCase() === cleanTitle &&
      b.date === a.date
    );
    if (hasDuplicate) {
      duplicateItemIds.add(a.id);
    }
  });

  // Sorter / filter values if needed, but keeping simple Notion style
  const statusColors: Record<StatusType, { bg: string; text: string; border: string }> = {
    'PROGRAMADO': { bg: 'bg-[#E0EFFE] dark:bg-[#1E3A5F]/60', text: 'text-[#1D4ED8] dark:text-[#60A5FA]', border: 'border-transparent' }, 
    'REPROGRAMADO': { bg: 'bg-[#E8DEEE] dark:bg-[#3B1F54]/60', text: 'text-[#5B2A82] dark:text-[#D8B4FE]', border: 'border-transparent' },
    'CONCLUIDO': { bg: 'bg-[#DBEDDB] dark:bg-[#1B3F22]/60', text: 'text-[#1C5E28] dark:text-[#86EFAC]', border: 'border-transparent' },
    'PENDENTE': { bg: 'bg-[#FDECC8] dark:bg-[#5F370E]/60', text: 'text-[#B35F00] dark:text-[#FDE047]', border: 'border-transparent' }
  };

  const priorityColors: Record<PriorityType, string> = {
    'Alta': 'bg-[#FFE2DD] dark:bg-[#7F1D1D]/50 text-[#C12E2A] dark:text-[#FCA5A5] border-transparent border font-bold',
    'Media': 'bg-[#FDECC8] dark:bg-[#78350F]/50 text-[#B35F00] dark:text-[#FDE047] border-transparent border font-semibold',
    'Baixa': 'bg-[#E3E2E0] dark:bg-[#2D2D2D]/50 text-[#5A5A57] dark:text-[#9CA3AF] border-transparent border'
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    
    onAddItem({
      title: quickTitle,
      status: 'PROGRAMADO',
      priority: 'Media',
      tasks: [],
      photos: [],
      notes: '',
      isPublic: false
    });
    setQuickTitle('');
  };

  // Human date formatter in Portuguese
  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return 'Sem data';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Drag-and-Drop Handlers
  const handleDragStart = (id: string, e: React.DragEvent) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItemId !== id && dragOverItemId !== id) {
      setDragOverItemId(id);
    }
  };

  const handleDrop = (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!onReorderItems || !draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null);
      setDragOverItemId(null);
      return;
    }

    const draggedIndex = items.findIndex(item => item.id === draggedItemId);
    const targetIndex = items.findIndex(item => item.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItemId(null);
      setDragOverItemId(null);
      return;
    }

    const reorderedList = [...items];
    const [removed] = reorderedList.splice(draggedIndex, 1);
    reorderedList.splice(targetIndex, 0, removed);

    onReorderItems(reorderedList);
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  return (
    <div className="w-full overflow-x-auto select-none rounded-lg border border-[#EDEDEB] dark:border-[#2C2C2C] bg-white dark:bg-[#1E1E1E] text-[#37352F] dark:text-[#E3E3E2] font-sans antialiased text-xs transition-colors duration-200">
      <table className="w-full text-left border-collapse table-fixed min-w-[950px]">
        {/* Table Head */}
        <thead>
          <tr className="border-b border-[#EDEDEB] dark:border-[#2C2C2C] bg-[#F7F7F5] dark:bg-[#202020] text-[#A4A4A2] dark:text-[#8E8E8D] text-[11px] font-semibold uppercase tracking-wider">
            {/* Grab Handle Column Header */}
            <th className="w-[3%] px-1 py-1.5 text-center border-r border-[#EDEDEB] dark:border-[#2C2C2C]">
              <span className="sr-only">Ordem</span>
            </th>
            
            {/* SI/OSE/AL (Title) Column Header */}
            <th className="w-[20%] px-4 py-2 hover:bg-[#EBEBE9] dark:hover:bg-[#262626] border-r border-[#EDEDEB] dark:border-[#2C2C2C] group">
              <div className="flex items-center justify-between gap-1 select-none">
                <div 
                  onClick={() => openColOptions(findCol('title'))} 
                  className={`flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:opacity-80 transition-opacity truncate w-full ${getAlignFlexClass(findCol('title').alignment)}`}
                  title="Configurar esta coluna"
                >
                  <FileText size={13} className="shrink-0" />
                  <span className="truncate">{findCol('title').title}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => openColOptions(findCol('title'))}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-[#2A2A2A] rounded transition-all cursor-pointer text-[#A4A4A2]"
                  title="Configurações da coluna"
                >
                  <Sliders size={10} />
                </button>
              </div>
            </th>

            {/* Date Column Header */}
            <th className="w-[14%] px-4 py-2 hover:bg-[#EBEBE9] dark:hover:bg-[#262626] border-r border-[#EDEDEB] dark:border-[#2C2C2C] group">
              <div className="flex items-center justify-between gap-1 select-none">
                <div 
                  onClick={() => openColOptions(findCol('date'))} 
                  className={`flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:opacity-80 transition-opacity truncate w-full ${getAlignFlexClass(findCol('date').alignment)}`}
                  title="Configurar esta coluna"
                >
                  <CalendarIcon size={13} className="shrink-0" />
                  <span className="truncate">{findCol('date').title}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => openColOptions(findCol('date'))}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-[#2A2A2A] rounded transition-all cursor-pointer text-[#A4A4A2]"
                  title="Configurações da coluna"
                >
                  <Sliders size={10} />
                </button>
              </div>
            </th>

            {/* Semana Column Header */}
            <th className="w-[8%] px-4 py-2 hover:bg-[#EBEBE9] dark:hover:bg-[#262626] border-r border-[#EDEDEB] dark:border-[#2C2C2C] group">
              <div className="flex items-center justify-between gap-1 select-none">
                <div 
                  onClick={() => openColOptions(findCol('semana'))} 
                  className={`flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:opacity-80 transition-opacity truncate w-full ${getAlignFlexClass(findCol('semana').alignment)}`}
                  title="Configurar esta coluna"
                >
                  <Hash size={13} className="shrink-0" />
                  <span className="truncate">{findCol('semana').title}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => openColOptions(findCol('semana'))}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-[#2A2A2A] rounded transition-all cursor-pointer text-[#A4A4A2]"
                  title="Configurações da coluna"
                >
                  <Sliders size={10} />
                </button>
              </div>
            </th>

            {/* Status Column Header */}
            <th className="w-[12%] px-4 py-2 hover:bg-[#EBEBE9] dark:hover:bg-[#262626] border-r border-[#EDEDEB] dark:border-[#2C2C2C] group">
              <div className="flex items-center justify-between gap-1 select-none">
                <div 
                  onClick={() => openColOptions(findCol('status'))} 
                  className={`flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:opacity-80 transition-opacity truncate w-full ${getAlignFlexClass(findCol('status').alignment)}`}
                  title="Configurar esta coluna"
                >
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span className="truncate">{findCol('status').title}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => openColOptions(findCol('status'))}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-[#2A2A2A] rounded transition-all cursor-pointer text-[#A4A4A2]"
                  title="Configurações da coluna"
                >
                  <Sliders size={10} />
                </button>
              </div>
            </th>

            {/* Coerencia Column Header */}
            <th className="w-[13%] px-4 py-2 hover:bg-[#EBEBE9] dark:hover:bg-[#262626] border-r border-[#EDEDEB] dark:border-[#2C2C2C] group">
              <div className="flex items-center justify-between gap-1 select-none">
                <div 
                  onClick={() => openColOptions(findCol('coerente'))} 
                  className={`flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:opacity-80 transition-opacity truncate w-full ${getAlignFlexClass(findCol('coerente').alignment)}`}
                  title="Configurar esta coluna"
                >
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span className="truncate">{findCol('coerente').title}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => openColOptions(findCol('coerente'))}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-[#2A2A2A] rounded transition-all cursor-pointer text-[#A4A4A2]"
                  title="Configurações da coluna"
                >
                  <Sliders size={10} />
                </button>
              </div>
            </th>

            {/* Quant Column Header */}
            <th className="w-[7%] px-4 py-2 hover:bg-[#EBEBE9] dark:hover:bg-[#262626] border-r border-[#EDEDEB] dark:border-[#2C2C2C] group">
              <div className="flex items-center justify-between gap-1 select-none">
                <div 
                  onClick={() => openColOptions(findCol('quant'))} 
                  className={`flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:opacity-80 transition-opacity truncate w-full ${getAlignFlexClass(findCol('quant').alignment)}`}
                  title="Configurar esta coluna"
                >
                  <Hash size={13} className="shrink-0" />
                  <span className="truncate">{findCol('quant').title}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => openColOptions(findCol('quant'))}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-[#2A2A2A] rounded transition-all cursor-pointer text-[#A4A4A2]"
                  title="Configurações da coluna"
                >
                  <Sliders size={10} />
                </button>
              </div>
            </th>

            {/* Priority Column Header */}
            <th className="w-[9%] px-4 py-2 hover:bg-[#EBEBE9] dark:hover:bg-[#262626] border-r border-[#EDEDEB] dark:border-[#2C2C2C] group">
              <div className="flex items-center justify-between gap-1 select-none">
                <div 
                  onClick={() => openColOptions(findCol('priority'))} 
                  className={`flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:opacity-80 transition-opacity truncate w-full ${getAlignFlexClass(findCol('priority').alignment)}`}
                  title="Configurar esta coluna"
                >
                  <Tag size={13} className="shrink-0" />
                  <span className="truncate">{findCol('priority').title}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => openColOptions(findCol('priority'))}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-[#2A2A2A] rounded transition-all cursor-pointer text-[#A4A4A2]"
                  title="Configurações da coluna"
                >
                  <Sliders size={10} />
                </button>
              </div>
            </th>

            <th className="w-[14%] px-4 py-2 text-center text-[#A4A4A2] dark:text-[#8E8E8D]">
              <span className="font-bold uppercase text-[10px] tracking-wider">AÇÕES</span>
            </th>
          </tr>

          {/* Interactive Column Filters Row (Filtros nos Títulos de cada coluna) */}
          <tr className="bg-[#FAF9F5] dark:bg-[#1D1D1B] border-b border-[#EDEDEB] dark:border-[#2C2C2C]">
            {/* Grab handle empty filter */}
            <td className="px-1 py-1 px-1.5 text-center border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80">
              {(colFilterTitle || colFilterDate || colFilterSemana || colFilterStatus !== 'all' || colFilterCoerence !== 'all' || colFilterPriority !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setColFilterTitle('');
                    setColFilterDate('');
                    setColFilterSemana('');
                    setColFilterStatus('all');
                    setColFilterCoerence('all');
                    setColFilterPriority('all');
                  }}
                  className="h-5 w-5 flex items-center justify-center text-red-600 hover:text-red-700 bg-red-100/60 hover:bg-red-150 dark:bg-red-950/30 dark:hover:bg-red-900/40 rounded text-[10px] font-bold mx-auto cursor-pointer transition-colors"
                  title="Limpar filtros das colunas"
                >
                  ✕
                </button>
              )}
            </td>

            {/* Title Filter */}
            <td className="px-2 py-1.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80">
              <input
                type="text"
                placeholder={`Filtrar ${findCol('title').title}...`}
                value={colFilterTitle}
                onChange={(e) => setColFilterTitle(e.target.value)}
                className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] hover:border-zinc-300 dark:hover:border-zinc-650 focus:border-zinc-400 dark:focus:border-[#525252] focus:ring-1 focus:ring-zinc-100 rounded px-1.5 py-0.5 text-[11px] placeholder-[#A4A4A2] dark:placeholder-[#6E6E6C] text-[#37352F] dark:text-[#E3E3E2] outline-none transition-colors"
              />
            </td>
 
            {/* Date Filter */}
            <td className="px-2 py-1.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80">
              <input
                type="text"
                placeholder={`Filtrar ${findCol('date').title.toLowerCase()}...`}
                value={colFilterDate}
                onChange={(e) => setColFilterDate(e.target.value)}
                className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] hover:border-zinc-300 dark:hover:border-zinc-650 focus:border-zinc-400 dark:focus:border-[#525252] focus:ring-1 focus:ring-zinc-100 rounded px-1.5 py-0.5 text-[11px] placeholder-[#A4A4A2] dark:placeholder-[#6E6E6C] text-[#37352F] dark:text-[#E3E3E2] outline-none transition-colors"
              />
            </td>
 
            {/* Semana Filter */}
            <td className="px-2 py-1.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80">
              <input
                type="text"
                placeholder="Ex: 24"
                value={colFilterSemana}
                onChange={(e) => setColFilterSemana(e.target.value)}
                className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] hover:border-zinc-300 dark:hover:border-zinc-650 focus:border-zinc-400 dark:focus:border-[#525252] focus:ring-1 focus:ring-zinc-100 rounded px-1 py-0.5 text-[11px] placeholder-[#A4A4A2] dark:placeholder-[#6E6E6C] text-[#37352F] dark:text-[#E3E3E2] outline-none text-center font-mono transition-colors"
              />
            </td>

            {/* Status Filter */}
            <td className="px-2 py-1.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80">
              <select
                value={colFilterStatus}
                onChange={(e) => setColFilterStatus(e.target.value)}
                className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] hover:border-zinc-300 dark:hover:border-zinc-650 focus:border-zinc-400 dark:focus:border-[#525252] rounded px-1.5 py-0.5 text-[10px] text-[#37352F] dark:text-[#E3E3E2] font-bold uppercase cursor-pointer outline-none transition-colors"
              >
                <option value="all" className="dark:bg-[#1E1E1E]">TODOS</option>
                <option value="PROGRAMADO" className="dark:bg-[#1E1E1E]">PROGRAMADO</option>
                <option value="REPROGRAMADO" className="dark:bg-[#1E1E1E]">REPROGRAMADO</option>
                <option value="CONCLUIDO" className="dark:bg-[#1E1E1E]">CONCLUÍDO</option>
                <option value="PENDENTE" className="dark:bg-[#1E1E1E]">PENDENTE</option>
              </select>
            </td>

            {/* Coerência Filter */}
            <td className="px-2 py-1.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80">
              <select
                value={colFilterCoerence}
                onChange={(e) => setColFilterCoerence(e.target.value)}
                className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] hover:border-zinc-300 dark:hover:border-zinc-650 focus:border-zinc-400 dark:focus:border-[#525252] rounded px-1.5 py-0.5 text-[10px] text-[#37352F] dark:text-[#E3E3E2] font-bold uppercase cursor-pointer outline-none transition-colors"
              >
                <option value="all" className="dark:bg-[#1E1E1E]">TODOS</option>
                <option value="ok" className="dark:bg-[#1E1E1E]">COERENTE OK (🟢)</option>
                <option value="x" className="dark:bg-[#1E1E1E]">INCOERENTE (🔴 X)</option>
                <option value="none" className="dark:bg-[#1E1E1E]">PENDENTES</option>
              </select>
            </td>

            {/* QUANT (Empty helper placeholder) */}
            <td className="px-2 py-1.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80 text-center text-[10px] font-bold text-[#A4A4A2] dark:text-[#6E6E6C] select-none bg-[#F7F7F5]/40 dark:bg-[#202020]/40 font-mono">
              Filtro
            </td>

            {/* Priority Filter */}
            <td className="px-2 py-1.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80">
              <select
                value={colFilterPriority}
                onChange={(e) => setColFilterPriority(e.target.value)}
                className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] hover:border-zinc-300 dark:hover:border-zinc-650 focus:border-zinc-400 dark:focus:border-[#525252] rounded px-1.5 py-0.5 text-[10px] text-[#37352F] dark:text-[#E3E3E2] font-semibold cursor-pointer outline-none transition-colors"
              >
                <option value="all" className="dark:bg-[#1E1E1E]">TODAS</option>
                <option value="Alta" className="dark:bg-[#1E1E1E]">Alta 🔴</option>
                <option value="Media" className="dark:bg-[#1E1E1E]">Média 🟡</option>
                <option value="Baixa" className="dark:bg-[#1E1E1E]">Baixa ⚪</option>
              </select>
            </td>

            {/* Actions (Filter Counter Indicator) */}
            <td className="px-2 py-1.5 text-center text-[9px] text-[#A4A4A2] dark:text-[#6E6E6C] font-semibold uppercase tracking-wider select-none">
              {filteredDisplayItems.length} visíveis
            </td>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {filteredDisplayItems.map((item) => {
            const isAuthor = item.ownerId === currentUserId;
            const normalizedStatus = normalizeStatus(item.status);
            const isDragging = item.id === draggedItemId;
            const isOver = item.id === dragOverItemId;

            return (
              <tr 
                key={item.id}
                draggable={isAuthor}
                onDragStart={(e) => handleDragStart(item.id, e)}
                onDragOver={(e) => handleDragOver(item.id, e)}
                onDragLeave={() => setDragOverItemId(null)}
                onDrop={(e) => handleDrop(item.id, e)}
                className={`group border-b border-[#EDEDEB]/80 dark:border-[#2C2C2C] hover:bg-[#F7F7F5] dark:hover:bg-[#252525] transition-all relative ${
                  isDragging ? 'opacity-40 bg-zinc-100 dark:bg-[#2A2A2A]' : ''
                } ${isOver ? 'border-t-2 border-t-blue-500 bg-blue-50/30' : ''}`}
                onMouseEnter={() => setHoveredRowId(item.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                id={`item-row-${item.id}`}
              >
                {/* Grab handle for Drag and Drop */}
                <td className="px-1 py-2.5 text-center border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80 cursor-grab active:cursor-grabbing text-zinc-300 dark:text-[#525252] group-hover:text-zinc-500 dark:group-hover:text-[#A4A4A2] transition-colors">
                  <div className="flex items-center justify-center">
                    <GripVertical size={13} />
                  </div>
                </td>

                {/* Title */}
                <td className={`px-4 py-2.5 font-normal border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80 truncate relative ${getAlignClass(findCol('title').alignment)}`}>
                  <div className={`flex items-center gap-2 truncate ${getAlignFlexClass(findCol('title').alignment)}`}>
                    <FileText size={15} className="text-[#A4A4A2] dark:text-[#6E6E6C] shrink-0" />
                    <span 
                      onClick={() => onSelectItem(item)}
                      className="truncate hover:underline decoration-[#37352F] dark:decoration-[#E3E3E2] cursor-pointer font-medium text-[#37352F] dark:text-[#E3E3E2]"
                    >
                      {formatTitle(item.title)}
                    </span>
                    {duplicateItemIds.has(item.id) && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 text-[9px] font-extrabold flex items-center gap-1 shrink-0 select-none shadow-3xs animate-pulse" title="Linha Duplicada - Existe outra atividade com o mesmo título e na mesma data">
                        <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                        <span>Duplicada</span>
                      </span>
                    )}
                    <div className="flex items-center gap-1 shrink-0 ml-auto select-none">
                      {item.photos && item.photos.length > 0 && (
                        <ImageIcon size={12} className="text-sky-600 dark:text-sky-400 shrink-0" title={`${item.photos.length} foto(s)`} />
                      )}
                      {item.tasks && item.tasks.length > 0 && (
                        <span className="text-[10px] text-[#A4A4A2] dark:text-[#6E6E6C] font-mono" title="Checklist completados">
                           ({item.tasks.filter((t) => t.completed).length}/{item.tasks.length})
                        </span>
                      )}
                      {item.isPublic ? (
                        <Globe size={11} className="text-emerald-600 dark:text-emerald-400 shrink-0" title="Compartilhado (Público)" />
                      ) : (
                        <Lock size={11} className="text-[#A4A4A2] dark:text-[#6E6E6C] shrink-0" title="Privado" />
                      )}
                    </div>
                  </div>
                </td>

                {/* Data */}
                <td className={`px-4 py-2.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80 text-[#37352F] dark:text-[#E3E3E2] ${getAlignClass(findCol('date').alignment)}`} onClick={(e) => e.stopPropagation()}>
                  <div className={`flex items-center gap-2 ${getAlignFlexClass(findCol('date').alignment)}`}>
                    <input
                      type="date"
                      value={item.date}
                      disabled={!isAuthor}
                      onChange={(e) => onUpdateField(item.id, 'date', e.target.value)}
                      className="bg-transparent border-0 outline-none w-7 h-5 overflow-hidden py-0.5 opacity-50 focus:opacity-100 cursor-pointer shrink-0 font-sans dark:text-[#E3E3E2] filter dark:invert"
                    />
                    <span className="text-[11px] truncate whitespace-nowrap">{formatDateValue(item.date)}</span>
                  </div>
                </td>

                {/* Semana */}
                <td className={`px-4 py-2.5 font-mono border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80 ${getAlignClass(findCol('semana').alignment)}`} onClick={(e) => e.stopPropagation()}>
                  <div className={`flex items-center gap-1 ${getAlignFlexClass(findCol('semana').alignment)}`}>
                    {findCol('semana').prefix && <span className="opacity-60 text-[10px] select-none font-sans font-medium text-[#37352F] dark:text-[#E3E3E2]">{findCol('semana').prefix}</span>}
                    <input
                      type="number"
                      value={item.semana || ''}
                      disabled={!isAuthor}
                      onChange={(e) => onUpdateField(item.id, 'semana', Number(e.target.value))}
                      className="w-12 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-zinc-200 rounded px-1 text-[#37352F] dark:text-[#E3E3E2] text-xs font-mono text-center"
                    />
                    {findCol('semana').suffix && <span className="opacity-60 text-[10px] select-none font-sans font-medium text-[#37352F] dark:text-[#E3E3E2]">{findCol('semana').suffix}</span>}
                  </div>
                </td>

                {/* STATUS */}
                <td className={`px-4 py-2.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80 ${getAlignClass(findCol('status').alignment)}`} onClick={(e) => e.stopPropagation()}>
                  <div className={`flex items-center ${getAlignFlexClass(findCol('status').alignment)}`}>
                    <select
                      value={normalizedStatus}
                      disabled={!isAuthor}
                      onChange={(e) => onUpdateField(item.id, 'status', e.target.value)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border-0 uppercase outline-none cursor-pointer ${statusColors[normalizedStatus].bg} ${statusColors[normalizedStatus].text}`}
                    >
                      <option value="PROGRAMADO" className="dark:bg-[#1E1E1E]">PROGRAMADO</option>
                      <option value="REPROGRAMADO" className="dark:bg-[#1E1E1E]">REPROGRAMADO</option>
                      <option value="CONCLUIDO" className="dark:bg-[#1E1E1E]">CONCLUÍDO</option>
                      <option value="PENDENTE" className="dark:bg-[#1E1E1E]">PENDENTE</option>
                    </select>
                  </div>
                </td>

                {/* COERÊNCIA (OK/X) CHECKBOX COMPONENT */}
                <td className={`px-4 py-2.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80 align-middle ${getAlignClass(findCol('coerente').alignment)}`} onClick={(e) => e.stopPropagation()}>
                  <div className={`flex items-center gap-2.5 ${getAlignFlexClass(findCol('coerente').alignment)}`}>
                    {/* OK (Coerente) Box */}
                    <button
                      type="button"
                      disabled={!isAuthor}
                      onClick={() => onUpdateField(item.id, 'coerenteOk', !item.coerenteOk)}
                      className={`h-6 w-6 rounded-md flex items-center justify-center border font-bold transition-all duration-200 ease-out cursor-pointer active:scale-95 focus:outline-none ${
                        item.coerenteOk
                          ? 'bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-200 scale-105 z-10'
                          : 'bg-[#F4F4F3]/80 dark:bg-[#2A2A2A] border-zinc-200 dark:border-[#383838] text-[#A4A4A2] dark:text-[#6E6E6C] hover:bg-emerald-50 dark:hover:bg-emerald-950/25 hover:text-emerald-600 hover:border-emerald-400 hover:scale-105'
                      }`}
                      title={item.coerenteOk ? "Coerente OK: Ativado" : "Marcar como Coerente OK"}
                    >
                      <Check size={13} className={`stroke-[3.5px] transition-transform duration-200 ${item.coerenteOk ? 'scale-110 rotate-0' : 'scale-70'}`} />
                    </button>

                    {/* X (Incoerente) Box */}
                    <button
                      type="button"
                      disabled={!isAuthor}
                      onClick={() => onUpdateField(item.id, 'incoerenteX', !item.incoerenteX)}
                      className={`h-6 w-6 rounded-md flex items-center justify-center border font-bold transition-all duration-200 ease-out cursor-pointer active:scale-95 focus:outline-none ${
                        item.incoerenteX
                          ? 'bg-red-500 border-red-600 text-white shadow-md shadow-red-200 scale-105 z-10'
                          : 'bg-[#F4F4F3]/80 dark:bg-[#2A2A2A] border-zinc-200 dark:border-[#383838] text-[#A4A4A2] dark:text-[#6E6E6C] hover:bg-red-50 dark:hover:bg-red-950/25 hover:text-red-600 hover:border-red-400 hover:scale-105'
                      }`}
                      title={item.incoerenteX ? "Incoerente: Ativado" : "Marcar como Incoerente"}
                    >
                      <X size={13} className={`stroke-[3.5px] transition-transform duration-200 ${item.incoerenteX ? 'scale-110 rotate-0' : 'scale-70'}`} />
                    </button>
                  </div>
                </td>

                {/* QUANT */}
                <td className={`px-4 py-2.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80 font-mono text-[#5A5A57] dark:text-[#A4A4A2] ${getAlignClass(findCol('quant').alignment)}`} onClick={(e) => e.stopPropagation()}>
                  <div className={`flex items-center gap-0.5 ${getAlignFlexClass(findCol('quant').alignment)}`}>
                    {findCol('quant').prefix && <span className="opacity-60 text-[10px] select-none font-sans font-medium text-[#37352F] dark:text-[#E3E3E2]">{findCol('quant').prefix}</span>}
                    <input
                      type="number"
                      placeholder="—"
                      disabled={!isAuthor}
                      value={item.quant !== null && item.quant !== undefined ? item.quant : ''}
                      onChange={(e) => onUpdateField(item.id, 'quant', e.target.value ? Number(e.target.value) : null)}
                      className="w-16 bg-transparent border-0 focus:outline-[#383838] focus:ring-1 focus:ring-zinc-200 rounded px-1 text-[#37352F] dark:text-[#E3E3E2] text-xs font-mono text-center"
                    />
                    {findCol('quant').suffix && <span className="opacity-60 text-[10px] select-none font-sans font-medium text-[#37352F] dark:text-[#E3E3E2]">{findCol('quant').suffix}</span>}
                  </div>
                </td>

                {/* PRIORIDADE */}
                <td className={`px-4 py-2.5 border-r border-[#EDEDEB]/60 dark:border-[#2C2C2C]/80 ${getAlignClass(findCol('priority').alignment)}`} onClick={(e) => e.stopPropagation()}>
                  <div className={`flex items-center ${getAlignFlexClass(findCol('priority').alignment)}`}>
                    <select
                      value={item.priority}
                      disabled={!isAuthor}
                      onChange={(e) => onUpdateField(item.id, 'priority', e.target.value)}
                      className={`px-2 py-0.5 rounded text-[10px] outline-none cursor-pointer border-0 ${priorityColors[item.priority]}`}
                    >
                      <option value="Alta" className="dark:bg-[#1E1E1E]">{formatPriorityValue('Alta')}</option>
                      <option value="Media" className="dark:bg-[#1E1E1E]">{formatPriorityValue('Media')}</option>
                      <option value="Baixa" className="dark:bg-[#1E1E1E]">{formatPriorityValue('Baixa')}</option>
                    </select>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-2.5 text-center flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => onSelectItem(item)}
                    className="p-1 px-1.5 rounded bg-[#F1F1EF] dark:bg-[#2C2C2C] hover:bg-[#EBEBE9] dark:hover:bg-[#383838] text-[#37352F] dark:text-[#E3E3E2] text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap border border-[#EDEDEB] dark:border-[#383838] shadow-2xs hover:shadow-xs active:scale-95"
                    title="Entrar e Editar"
                  >
                    <ExternalLink size={11} />
                    <span>Abrir</span>
                  </button>

                  <button 
                    onClick={() => {
                      onAddItem({
                        title: `${item.title} (Cópia)`,
                        semana: item.semana,
                        date: item.date,
                        status: item.status,
                        quant: item.quant,
                        priority: item.priority,
                        tasks: item.tasks ? item.tasks.map(t => ({ ...t, id: 'task_' + Math.random().toString(36).substring(2, 9) })) : [],
                        photos: item.photos || [],
                        notes: item.notes || '',
                        isPublic: item.isPublic || false
                      });
                    }}
                    className="p-1 px-1.5 rounded bg-[#EBF5FF] dark:bg-[#1D4ED8]/20 hover:bg-[#DBEDFF] dark:hover:bg-[#1D4ED8]/30 text-[#1D4ED8] dark:text-[#60A5FA] text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap border border-[#D0E7FF] dark:border-[#1E3A8A]/40 shadow-2xs active:scale-95"
                    title="Duplicar atividade (Puxar Cópia)"
                  >
                    <Copy size={11} />
                    <span>Copiar</span>
                  </button>

                  {isAuthor ? (
                    <button 
                      onClick={(e) => onDeleteItem(item.id, e)}
                      title="Deletar atividade"
                      className="p-1.5 rounded text-[#A4A4A2] dark:text-[#6E6E6C] hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-955/25 transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#A4A4A2] select-none font-medium">Leitura</span>
                  )}
                </td>
              </tr>
            );
          })}

          {/* TOTAL ITEMS ROW */}
          <tr className="bg-[#FCFCFA]/95 dark:bg-[#1E1E1D]/95 border-b border-[#EDEDEB] dark:border-[#2C2C2C] font-sans">
            <td colSpan={9} className="px-4 py-2.5 text-right font-sans text-[11px] text-[#5A5A57] dark:text-[#A4A4A2] font-semibold">
              <span className="text-[#A4A4A2] dark:text-[#6E6E6C] uppercase tracking-wider text-[10px] mr-2">Total de itens:</span>
              <span className="bg-[#EDEDEB]/80 dark:bg-[#2C2C2C] px-2 py-0.5 rounded text-[#37352F] dark:text-[#E3E3E2] font-mono mr-1" title="Linhas atendendo aos filtros">
                {filteredDisplayItems.length}
              </span> 
              <span>de {items.length} itens</span>
            </td>
          </tr>

          {/* Quick Create row */}
          <tr className="border-b border-[#EDEDEB]/50 dark:border-[#2C2C2C]/50 bg-[#F7F7F5]/50 dark:bg-[#202020]/35">
            <td colSpan={9} className="px-4 py-2">
              <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
                <Plus size={14} className="text-[#A4A4A2] dark:text-[#6E6E6C] shrink-0" />
                <input
                  type="text"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="Nova página... Digite o título e aperte Enter para criar"
                  className="w-full bg-transparent border-none outline-none focus:ring-0 text-[#37352F] dark:text-[#E3E3E2] placeholder-[#A4A4A2] dark:placeholder-[#6E6E6C] transition-colors py-1 text-xs"
                />
              </form>
            </td>
          </tr>
        </tbody>
      </table>
      
      {items.length === 0 && (
        <div className="w-full text-center py-12 text-[#A4A4A2] dark:text-[#6E6E6C] flex flex-col items-center justify-center gap-2 bg-white dark:bg-[#1E1E1E]">
          <FileText size={24} className="text-[#A4A4A2] dark:text-[#6E6E6C]" />
          <p className="font-semibold text-xs">Nenhuma página disponível.</p>
          <p className="text-[11px]">Crie uma linha rápida usando o campo de entrada rápida ou clique em 'Nova atividade'!</p>
        </div>
      )}

      {/* Column Config modal popup */}
      {editingColumn && (
        <div 
          className="fixed inset-0 bg-black/45 backdrop-blur-2xs flex items-center justify-center z-[100] animate-fade-in p-4" 
          onClick={() => setEditingColumn(null)}
          id="col-config-modal-backdrop"
        >
          <div 
            className="bg-white dark:bg-[#1C1C1A] border border-[#EDEDEB] dark:border-[#2C2C2C] shadow-2xl rounded-xl w-full max-w-sm overflow-hidden transform transition-all tracking-tight" 
            onClick={(e) => e.stopPropagation()}
            id="col-config-modal-body"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#EDEDEB] dark:border-[#2C2C2C] bg-[#FAF9F6] dark:bg-[#181816] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders size={14} className="text-[#A4A4A2] dark:text-[#8E8E8D]" />
                <h3 className="font-bold text-xs text-[#37352F] dark:text-[#E3E3E2] uppercase tracking-wider">
                  Configurar Coluna: <span className="opacity-75 font-mono">{editingColumn.id}</span>
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingColumn(null)} 
                className="text-[#A4A4A2] hover:text-[#37352F] dark:hover:text-[#E3E3E2] transition-colors p-1 hover:bg-[#EDEDEB] dark:hover:bg-[#2C2C2C] rounded-full cursor-pointer"
                id="col-config-close"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content Form */}
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Title label */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#A4A4A2] dark:text-[#8E8E8D] uppercase tracking-wider">
                  Rótulo da Coluna
                </label>
                <input
                  type="text"
                  value={tempColTitle}
                  onChange={(e) => setTempColTitle(e.target.value)}
                  className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] rounded px-2.5 py-1 text-xs text-[#37352F] dark:text-[#E3E3E2] outline-none focus:ring-1 focus:ring-zinc-350"
                  placeholder="Nome customizado..."
                  id="col-config-title-input"
                />
              </div>

              {/* Alignment */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#A4A4A2] dark:text-[#8E8E8D] uppercase tracking-wider">
                  Alinhamento do Texto
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => setTempColAlignment(align)}
                      className={`px-2 py-1 border text-[11px] font-semibold rounded font-sans cursor-pointer transition-all ${
                        tempColAlignment === align
                          ? 'bg-[#37352F] border-[#37352F] text-white dark:bg-[#E3E3E2] dark:border-[#E3E3E2] dark:text-[#1C1C1B]'
                          : 'bg-white dark:bg-[#202020] border-[#EDEDEB] dark:border-[#2C2C2C] text-[#37352F] dark:text-[#E3E3E2] hover:bg-[#F4F4F3] dark:hover:bg-[#2A2A2A]'
                      }`}
                      id={`col-config-align-${align}`}
                    >
                      {align === 'left' ? 'Esquerda' : align === 'center' ? 'Centro' : 'Direita'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Column Formats */}
              {editingColumn.id === 'date' && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-[#A4A4A2] dark:text-[#8E8E8D] uppercase tracking-wider">
                    Formato de Data
                  </label>
                  <select
                    value={tempColFormat}
                    onChange={(e) => setTempColFormat(e.target.value)}
                    className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] rounded px-2.5 py-1 text-xs text-[#37352F] dark:text-[#E3E3E2] outline-none cursor-pointer"
                    id="col-config-format-date"
                  >
                    <option value="default">Padrão (DD/MM/AAAA)</option>
                    <option value="friendly_short">Curto (ex: 15 Jun)</option>
                    <option value="friendly">Médio (ex: 15 Jun 2026)</option>
                    <option value="full">Por Extenso (ex: Segunda, 15 de Junho)</option>
                    <option value="iso">Internacional (AAAA-MM-DD)</option>
                  </select>
                </div>
              )}

              {/* Priority Column Formats */}
              {editingColumn.id === 'priority' && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-[#A4A4A2] dark:text-[#8E8E8D] uppercase tracking-wider">
                    Estilo de Prioridade
                  </label>
                  <select
                    value={tempColFormat}
                    onChange={(e) => setTempColFormat(e.target.value)}
                    className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] rounded px-2.5 py-1 text-xs text-[#37352F] dark:text-[#E3E3E2] outline-none cursor-pointer"
                    id="col-config-format-priority"
                  >
                    <option value="emoji_text">Emoji + Texto (ex: 🔴 Alta)</option>
                    <option value="emoji_only">Apenas Emoji (ex: 🔴)</option>
                    <option value="text_only">Apenas Texto (ex: Alta)</option>
                  </select>
                </div>
              )}

              {/* Title Column Case Formats */}
              {editingColumn.id === 'title' && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-[#A4A4A2] dark:text-[#8E8E8D] uppercase tracking-wider">
                    Formatador de Caixa
                  </label>
                  <select
                    value={tempColFormat}
                    onChange={(e) => setTempColFormat(e.target.value)}
                    className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] rounded px-2.5 py-1 text-xs text-[#37352F] dark:text-[#E3E3E2] outline-none cursor-pointer"
                    id="col-config-format-title"
                  >
                    <option value="default">Manter digitado</option>
                    <option value="uppercase">TUDO EM MAIÚSCULO</option>
                    <option value="lowercase">tudo em minúsculo</option>
                  </select>
                </div>
              )}

              {/* Decimals for Quant or Semana */}
              {editingColumn.id === 'quant' && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-[#A4A4A2] dark:text-[#8E8E8D] uppercase tracking-wider">
                    Casas Decimais
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={tempColDecimals}
                    onChange={(e) => setTempColDecimals(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] rounded px-2.5 py-1 text-xs text-[#37352F] dark:text-[#E3E3E2] outline-none"
                    id="col-config-decimals"
                  />
                </div>
              )}

              {/* Prefixes and Suffixes Settings */}
              {['title', 'semana', 'quant'].includes(editingColumn.id) && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#EDEDEB]/60 dark:border-[#2C2C2C]/50">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-[#A4A4A2] dark:text-[#8E8E8D] uppercase tracking-wider">
                      Prefixo
                    </label>
                    <input
                      type="text"
                      value={tempColPrefix}
                      onChange={(e) => setTempColPrefix(e.target.value)}
                      className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] rounded px-2.5 py-1 text-xs text-[#37352F] dark:text-[#E3E3E2] outline-none"
                      placeholder="Ex: R$, $"
                      id="col-config-prefix"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-[#A4A4A2] dark:text-[#8E8E8D] uppercase tracking-wider">
                      Sufixo
                    </label>
                    <input
                      type="text"
                      value={tempColSuffix}
                      onChange={(e) => setTempColSuffix(e.target.value)}
                      className="w-full bg-white dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] rounded px-2.5 py-1 text-xs text-[#37352F] dark:text-[#E3E3E2] outline-none"
                      placeholder="Ex: kg, un"
                      id="col-config-suffix"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-4 py-3 border-t border-[#EDEDEB] dark:border-[#2C2C2C] bg-[#FAF9F6] dark:bg-[#181816] flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetColumnOptions}
                className="px-2.5 py-1 text-xs font-bold rounded text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer border border-transparent hover:border-red-200"
                id="col-config-reset"
              >
                Resetar
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingColumn(null)}
                  className="px-2.5 py-1 text-xs font-bold rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#2C2C2C] transition-all cursor-pointer border border-[#EDEDEB] dark:border-[#2C2C2C]"
                  id="col-config-cancel"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveColumnOptions}
                  className="px-3.5 py-1 text-xs font-bold rounded text-white bg-[#37352F] dark:bg-[#E3E3E2] dark:text-[#1C1C1B] hover:opacity-90 shadow-2xs transition-all cursor-pointer active:scale-95"
                  id="col-config-save"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
