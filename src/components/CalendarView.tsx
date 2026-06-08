import React, { useState } from 'react';
import { AgendaItem, StatusType, normalizeStatus } from '../types';
import { ChevronLeft, ChevronRight, Plus, Image as ImageIcon, AlertTriangle } from 'lucide-react';

interface CalendarViewProps {
  items: AgendaItem[];
  onSelectItem: (item: AgendaItem) => void;
  onAddItem: (initialData?: Partial<AgendaItem>) => void;
}

export default function CalendarView({ items, onSelectItem, onAddItem }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

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

  // Names of months in Portuguese
  const monthsBR = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Calculate grid information
  const firstDayOfMonth = new Date(year, month, 1);
  const startDayIndex = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday...
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create an array of days to display
  const calendarCells: { dateStr: string | null; dayNumber: number | null }[] = [];
  
  // Empty spaces for previous month's wrapping
  for (let i = 0; i < startDayIndex; i++) {
    calendarCells.push({ dateStr: null, dayNumber: null });
  }

  // Days of the active month
  for (let day = 1; day <= daysInMonth; day++) {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    calendarCells.push({ dateStr, dayNumber: day });
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const getItemsForDate = (dateStr: string) => {
    return items.filter((item) => item.date === dateStr);
  };

  const statusBorderColors: Record<StatusType, string> = {
    'PROGRAMADO': 'border-l-blue-500 bg-blue-50/80 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200 hover:bg-blue-100/90 dark:hover:bg-blue-900/30',
    'REPROGRAMADO': 'border-l-purple-500 bg-purple-50/80 dark:bg-purple-950/20 text-purple-800 dark:text-purple-200 hover:bg-purple-100/90 dark:hover:bg-purple-900/30',
    'CONCLUIDO': 'border-l-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-850 dark:text-emerald-200 hover:bg-emerald-100/90 dark:hover:bg-[#1B3F22]/40',
    'PENDENTE': 'border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/15 text-amber-850 dark:text-amber-200 hover:bg-amber-100/90 dark:hover:bg-amber-900/25'
  };

  const handleQuickAddDate = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Calculate week number
    const targetDate = new Date(dateStr);
    const onejan = new Date(targetDate.getFullYear(), 0, 1);
    const millisecsInDay = 86400000;
    const weekNum = Math.ceil((((targetDate.getTime() - onejan.getTime()) / millisecsInDay) + onejan.getDay() + 1) / 7);

    onAddItem({
      date: dateStr,
      semana: weekNum,
      title: 'Nova Atividade',
      status: 'PROGRAMADO',
      priority: 'Media',
      tasks: [],
      photos: []
    });
  };

  return (
    <div className="w-full bg-white dark:bg-[#1E1E1E] text-[#37352F] dark:text-[#E3E3E2] border border-[#EDEDEB] dark:border-[#2C2C2C] rounded-lg p-4 font-sans select-none text-xs transition-colors duration-200">
      {/* Calendar Header with Navigation */}
      <div className="flex items-center justify-between mb-4 border-b border-[#EDEDEB] dark:border-[#2C2C2C] pb-4">
        <h2 className="text-sm font-bold text-[#37352F] dark:text-[#E3E3E2] flex items-center gap-1.5 uppercase tracking-wide">
          <span className="font-mono">{year}</span>
          <span className="text-[#A4A4A2] dark:text-[#6E6E6C] font-light">/</span>
          <span>{monthsBR[month]}</span>
        </h2>
        <div className="flex items-center gap-1 bg-[#F1F1EF] dark:bg-[#2C2C2C] p-0.5 rounded border border-[#EDEDEB] dark:border-[#383838]">
          <button 
            onClick={() => navigateMonth('prev')}
            className="p-1 hover:bg-[#EBEBE9] dark:hover:bg-[#383838] rounded transition-colors text-[#5A5A57] dark:text-[#A4A4A2] hover:text-[#37352F] dark:hover:text-[#E3E3E2] cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="px-2 py-0.5 text-xs font-semibold hover:bg-[#EBEBE9] dark:hover:bg-[#383838] rounded transition-colors text-[#5A5A57] dark:text-[#A4A4A2] hover:text-[#37352F] dark:hover:text-[#E3E3E2] cursor-pointer"
          >
            Hoje
          </button>
          <button 
            onClick={() => navigateMonth('next')}
            className="p-1 hover:bg-[#EBEBE9] dark:hover:bg-[#383838] rounded transition-colors text-[#5A5A57] dark:text-[#A4A4A2] hover:text-[#37352F] dark:hover:text-[#E3E3E2] cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekdays indicator bar */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[#A4A4A2] dark:text-[#8E8E8D] text-[10px] font-bold uppercase tracking-wider py-1.5 bg-[#F7F7F5] dark:bg-[#202020] border border-[#EDEDEB] dark:border-[#2C2C2C] rounded-sm">
        {daysOfWeek.map((day) => (
          <div key={day} className="py-0.5">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid Cells */}
      <div className="grid grid-cols-7 gap-1 bg-[#EDEDEB] dark:bg-[#2C2C2C]">
        {calendarCells.map((cell, index) => {
          const isToday = cell.dateStr && cell.dateStr === new Date().toISOString().split('T')[0];
          const dateItems = cell.dateStr ? getItemsForDate(cell.dateStr) : [];

          return (
            <div 
              key={index}
              className={`min-h-[105px] bg-white dark:bg-[#1E1E1E] border border-[#EDEDEB]/35 dark:border-[#2C2C2C]/50 p-1.5 transition-all flex flex-col group relative ${
                cell.dateStr ? 'hover:bg-[#FBFBFA] dark:hover:bg-[#252525]' : 'opacity-25 pointer-events-none bg-[#F7F7F5] dark:bg-[#202020]/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded leading-tight ${
                  isToday ? 'bg-blue-600 dark:bg-blue-650 text-white font-extrabold' : 'text-[#5A5A57] dark:text-[#A4A4A2] font-semibold'
                }`}>
                  {cell.dayNumber}
                </span>

                {/* Quick Add icon inside cell */}
                {cell.dateStr && (
                  <button 
                    onClick={(e) => handleQuickAddDate(cell.dateStr!, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#EBEBE9] dark:hover:bg-[#2C2C2C] text-[#37352F] dark:text-[#E3E3E2] transition-all rounded cursor-pointer"
                    title="Adicionar evento neste dia"
                  >
                    <Plus size={11} />
                  </button>
                )}
              </div>

              {/* Items pills container inside cell */}
              <div className="flex-1 space-y-1 overflow-y-auto max-h-[80px] scrollbar-thin">
                {cell.dateStr && dateItems.map((item) => {
                  const normalizedStatus = normalizeStatus(item.status);
                  return (
                    <div 
                      key={item.id}
                      onClick={() => onSelectItem(item)}
                      className={`text-[9px] py-0.5 px-1 rounded cursor-pointer border-l-2 truncate transition-colors ${statusBorderColors[normalizedStatus] || statusBorderColors['PROGRAMADO']}`}
                      title={`${item.title} (${normalizedStatus})${duplicateItemIds.has(item.id) ? ' — DUPLICADA ⚠️' : ''}`}
                    >
                      <div className="flex items-center gap-1 truncate font-semibold">
                        <span className="truncate flex items-center gap-1">
                          {duplicateItemIds.has(item.id) && <AlertTriangle size={8} className="text-amber-500 shrink-0" />}
                          <span className="truncate">{item.title}</span>
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0 ml-auto opacity-70">
                          {item.photos && item.photos.length > 0 && <ImageIcon size={8} className="text-sky-700 font-bold" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
