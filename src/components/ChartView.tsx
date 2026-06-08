import React, { useState } from 'react';
import { AgendaItem, StatusType, PriorityType, normalizeStatus } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  Activity, 
  CheckSquare, 
  Filter, 
  SlidersHorizontal, 
  Calendar, 
  Hash, 
  ShieldAlert, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Tag,
  RefreshCw,
  TrendingUp,
  Award
} from 'lucide-react';

interface ChartViewProps {
  items: AgendaItem[];
}

export default function ChartView({ items }: ChartViewProps) {
  // -----------------------------------------------------
  // FILTER STATES
  // -----------------------------------------------------
  const [filterWeek, setFilterWeek] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCoerencia, setFilterCoerencia] = useState<string>('all');

  // Month labels and values
  const MONTHS = [
    { value: 'all', label: 'Todos os Meses' },
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ];

  // Helper to test if any filter is active
  const isAnyFilterActive = 
    filterWeek !== 'all' || 
    filterMonth !== 'all' || 
    filterDate !== '' || 
    filterPriority !== 'all' || 
    filterCoerencia !== 'all';

  const handleClearFilters = () => {
    setFilterWeek('all');
    setFilterMonth('all');
    setFilterDate('');
    setFilterPriority('all');
    setFilterCoerencia('all');
  };

  // 1. Extract unique week numbers from available items for the dropdown
  const uniqueWeeks = Array.from(
    new Set(
      items
        .map(item => item.semana)
        .filter((w): w is number => typeof w === 'number')
    )
  ).sort((a, b) => a - b);


  // -----------------------------------------------------
  // DATA FILTERING LOGIC
  // -----------------------------------------------------
  const filteredItems = items.filter(item => {
    // Week filter
    if (filterWeek !== 'all') {
      if (!item.semana || item.semana.toString() !== filterWeek) return false;
    }

    // Month filter
    if (filterMonth !== 'all') {
      if (!item.date) return false;
      const parts = item.date.split('-');
      if (parts.length < 2) return false;
      const m = parseInt(parts[1], 10).toString();
      if (m !== filterMonth) return false;
    }

    // Specific Date filter
    if (filterDate) {
      if (item.date !== filterDate) return false;
    }

    // Priority filter
    if (filterPriority !== 'all') {
      if (item.priority !== filterPriority) return false;
    }

    // Coerência filter
    if (filterCoerencia !== 'all') {
      if (filterCoerencia === 'ok') {
        if (!item.coerenteOk) return false;
      } else if (filterCoerencia === 'x') {
        if (!item.incoerenteX) return false;
      } else if (filterCoerencia === 'none') {
        if (item.coerenteOk || item.incoerenteX) return false;
      }
    }

    return true;
  });


  // -----------------------------------------------------
  // CALCULATED METRICS (ON FILTERED SET)
  // -----------------------------------------------------
  const totalFiltered = filteredItems.length;

  // Status distribution on filtered dataset
  const statusCounts: Record<StatusType, number> = {
    'PROGRAMADO': 0,
    'REPROGRAMADO': 0,
    'CONCLUIDO': 0,
    'PENDENTE': 0
  };

  filteredItems.forEach(item => {
    const normalizedStatus = normalizeStatus(item.status);
    if (statusCounts[normalizedStatus] !== undefined) {
      statusCounts[normalizedStatus]++;
    } else {
      statusCounts['PROGRAMADO']++;
    }
  });

  const statusData = [
    { name: 'PROGRAMADO', value: statusCounts['PROGRAMADO'], color: '#2E66E7' },
    { name: 'REPROGRAMADO', value: statusCounts['REPROGRAMADO'], color: '#8F39D3' },
    { name: 'CONCLUÍDO', value: statusCounts['CONCLUIDO'], color: '#10B981' }, // soft green
    { name: 'PENDENTE', value: statusCounts['PENDENTE'], color: '#F59E0B' } // amber/orange
  ].filter(d => d.value > 0);

  // Completed vs Pending (Others) of agenda items
  const concluidosCount = statusCounts['CONCLUIDO'];
  const programadosCount = statusCounts['PROGRAMADO'];
  const reprogramadosCount = statusCounts['REPROGRAMADO'];
  const pendentesCount = statusCounts['PENDENTE'];
  const naoConcluidosCount = totalFiltered - concluidosCount;

  const pctConcluido = totalFiltered > 0 ? Math.round((concluidosCount / totalFiltered) * 100) : 0;
  const pctProgramado = totalFiltered > 0 ? Math.round((programadosCount / totalFiltered) * 100) : 0;
  const pctReprogramado = totalFiltered > 0 ? Math.round((reprogramadosCount / totalFiltered) * 100) : 0;
  const pctPendente = totalFiltered > 0 ? Math.round((pendentesCount / totalFiltered) * 100) : 0;
  const pctNaoConcluidos = totalFiltered > 0 ? Math.round((naoConcluidosCount / totalFiltered) * 100) : 0;

  // Pie chart data for Concluido vs Não Concluido
  const completionRatioData = [
    { name: 'Concluído 🟢', value: concluidosCount, color: '#10B981' },
    { name: 'Não Concluido (Em Aberto) 🟡', value: naoConcluidosCount, color: '#F59E0B' }
  ].filter(d => d.value > 0);

  // Priority counts on filtered dataset
  const priorityCounts: Record<PriorityType, number> = {
    'Alta': 0,
    'Media': 0,
    'Baixa': 0
  };

  filteredItems.forEach(item => {
    if (priorityCounts[item.priority] !== undefined) {
      priorityCounts[item.priority]++;
    }
  });

  const priorityData = [
    { name: 'Alta 🔴', value: priorityCounts['Alta'], color: '#D43834' },
    { name: 'Média 🟡', value: priorityCounts['Media'], color: '#F59E0B' },
    { name: 'Baixa ⚪', value: priorityCounts['Baixa'], color: '#A4A4A2' }
  ].filter(d => d.value > 0);

  // Checklist statistics on filtered dataset
  let totalTasks = 0;
  let completedTasks = 0;
  filteredItems.forEach(item => {
    if (item.tasks && item.tasks.length > 0) {
      totalTasks += item.tasks.length;
      completedTasks += item.tasks.filter(t => t.completed).length;
    }
  });

  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Coherence Statistics
  const coerenteCount = filteredItems.filter(item => item.coerenteOk).length;
  const incoerenteCount = filteredItems.filter(item => item.incoerenteX).length;
  const semControleCount = totalFiltered - coerenteCount - incoerenteCount;

  // Custom tooltips
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[#EDEDEB] p-2.5 rounded shadow-lg text-xs font-sans select-none">
          <p className="text-[#37352F] font-bold">{payload[0].name}</p>
          <p className="text-[#5A5A57] mt-1 font-medium">Quantidade: <span className="font-mono text-xs font-bold text-[#37352F]">{payload[0].value}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-6 select-none font-sans text-xs">
      
      {/* -----------------------------------------------------
          FILTER PANEL BLOCK
         ----------------------------------------------------- */}
      <div className="bg-white border border-[#EDEDEB] rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 border-b border-[#EDEDEB]/60 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-[#37352F]" />
            <h3 className="text-xs font-bold text-[#37352F] uppercase tracking-wider">Filtros de Controle e Auditoria</h3>
          </div>
          
          {isAnyFilterActive && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 px-2.5 py-1 rounded text-[11px] font-bold transition-all border border-red-200 cursor-pointer shadow-2xs active:scale-95 shrink-0 self-end md:self-auto"
            >
              <RefreshCw size={11} className="animate-spin-once" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        {/* Filter Input Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          
          {/* Month Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-[#A4A4A2] font-semibold uppercase tracking-wider flex items-center gap-1">
              <Calendar size={11} />
              <span>Mês</span>
            </label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-[#F7F7F5] hover:bg-[#EDEDEB] border border-[#EDEDEB] focus:border-zinc-400 focus:bg-white rounded px-2 py-1.5 text-xs text-[#37352F] font-medium outline-none cursor-pointer transition-colors"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Week Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-[#A4A4A2] font-semibold uppercase tracking-wider flex items-center gap-1">
              <Hash size={11} />
              <span>Semana</span>
            </label>
            <select
              value={filterWeek}
              onChange={(e) => setFilterWeek(e.target.value)}
              className="w-full bg-[#F7F7F5] hover:bg-[#EDEDEB] border border-[#EDEDEB] focus:border-zinc-400 focus:bg-white rounded px-2 py-1.5 text-xs text-[#37352F] font-medium outline-none cursor-pointer transition-colors"
            >
              <option value="all">Todas as Semanas</option>
              {uniqueWeeks.map(wk => (
                <option key={wk} value={wk.toString()}>Semana {wk}</option>
              ))}
            </select>
          </div>

          {/* Exact Date Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-[#A4A4A2] font-semibold uppercase tracking-wider flex items-center gap-1">
              <Calendar size={11} />
              <span>Data Específica</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-[#F7F7F5] hover:bg-[#EDEDEB] border border-[#EDEDEB] focus:border-zinc-400 focus:bg-white rounded px-2 py-1 text-xs text-[#37352F] font-medium outline-none cursor-pointer transition-colors"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="absolute right-2 top-1.5 text-[10px] text-red-500 hover:text-red-700 font-bold"
                  title="Limpar Data"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Priority Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-[#A4A4A2] font-semibold uppercase tracking-wider flex items-center gap-1">
              <Tag size={11} />
              <span>Prioridade</span>
            </label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full bg-[#F7F7F5] hover:bg-[#EDEDEB] border border-[#EDEDEB] focus:border-zinc-400 focus:bg-white rounded px-2 py-1.5 text-xs text-[#37352F] font-medium outline-none cursor-pointer transition-colors"
            >
              <option value="all font-semibold">Todas as Prioridades</option>
              <option value="Alta">Alta 🔴</option>
              <option value="Media">Média 🟡</option>
              <option value="Baixa font-normal">Baixa ⚪</option>
            </select>
          </div>

          {/* Coherence Control Filter (Requested) */}
          <div className="space-y-1">
            <label className="text-[10px] text-[#A4A4A2] font-semibold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 size={11} className="text-[#37352F]" />
              <span>Coerência (OK/X)</span>
            </label>
            <select
              value={filterCoerencia}
              onChange={(e) => setFilterCoerencia(e.target.value)}
              className="w-full bg-[#F7F7F5] hover:bg-[#EDEDEB] border border-[#EDEDEB] focus:border-zinc-400 focus:bg-white rounded px-2 py-1.5 text-xs text-[#37352F] font-medium outline-none cursor-pointer transition-colors"
            >
              <option value="all">Todas as Coerências</option>
              <option value="ok" className="text-emerald-600 font-bold">Apenas Coerente OK (🟢)</option>
              <option value="x" className="text-red-500 font-bold">Apenas Incoerente (🔴 X)</option>
              <option value="none" className="text-[#A4A4A2]">Sem validação/marcação</option>
            </select>
          </div>

        </div>

        {/* Display active filter indicators */}
        {isAnyFilterActive && (
          <div className="mt-3.5 bg-[#F7F7F5]/80 border border-[#EDEDEB]/80 rounded p-2 text-[11px] text-[#5A5A57] flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-bold uppercase text-[9px] text-[#A4A4A2] tracking-wider">Filtros Ativados:</span>
            {filterMonth !== 'all' && (
              <span className="bg-white border border-[#EDEDEB] px-1.5 py-0.5 rounded font-medium text-[#37352F]">
                Mês: <strong className="font-bold">{MONTHS.find(m => m.value === filterMonth)?.label}</strong>
              </span>
            )}
            {filterWeek !== 'all' && (
              <span className="bg-white border border-[#EDEDEB] px-1.5 py-0.5 rounded font-medium text-[#37352F]">
                Semana: <strong className="font-bold"># {filterWeek}</strong>
              </span>
            )}
            {filterDate && (
              <span className="bg-white border border-[#EDEDEB] px-1.5 py-0.5 rounded font-medium text-[#37352F]">
                Data: <strong className="font-bold">{filterDate}</strong>
              </span>
            )}
            {filterPriority !== 'all' && (
              <span className="bg-white border border-[#EDEDEB] px-1.5 py-0.5 rounded font-medium text-[#37352F]">
                Prioridade: <strong className="font-bold text-[#D43834]">{filterPriority}</strong>
              </span>
            )}
            {filterCoerencia !== 'all' && (
              <span className="bg-white border border-[#EDEDEB] px-1.5 py-0.5 rounded font-medium text-[#37352F]">
                Coerência: <strong className="font-bold">
                  {filterCoerencia === 'ok' ? 'COERENTE OK (🟢)' : filterCoerencia === 'x' ? 'INCOERENTE (🔴 X)' : 'SEM CONTROLE'}
                </strong>
              </span>
            )}
          </div>
        )}
      </div>

      {totalFiltered === 0 ? (
        <div className="w-full text-center py-16 bg-white border border-[#EDEDEB] rounded-lg text-[#A4A4A2] flex flex-col items-center justify-center gap-2 select-none shadow-2xs">
          <Activity size={28} className="text-[#A4A4A2] opacity-60 animate-pulse" />
          <p className="font-bold text-xs text-[#37352F]">Nenhuma atividade encontrada para as seleções de filtro.</p>
          <p className="text-[11px] mb-4">Modifique os controles do painel ou clique para limpar todos os parâmetros ativos.</p>
          <button
            onClick={handleClearFilters}
            className="bg-[#2E66E7] hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded transition-colors shadow-2xs active:scale-95 cursor-pointer"
          >
            Limpar Todos os Filtros
          </button>
        </div>
      ) : (
        <>
          {/* -----------------------------------------------------
              METRICS INDICATOR CARDS (UPDATED AND DILUTED SYSTEM)
             ----------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            
            {/* Metric 1: Atividades Filtradas (Total) */}
            <div className="bg-white border border-[#EDEDEB] p-4 rounded-lg flex items-center gap-3 shadow-2xs">
              <div className="p-3 bg-blue-50 text-blue-600 rounded shrink-0 border border-blue-100">
                <Activity size={20} />
              </div>
              <div>
                <div className="text-[10px] text-[#A4A4A2] uppercase font-bold tracking-wider">Atividades Filtradas</div>
                <div className="text-2xl font-bold text-[#37352F] mt-0.5 font-mono">
                  {totalFiltered} <span className="text-xs text-[#A4A4A2] font-normal font-sans">de {items.length}</span>
                </div>
              </div>
            </div>
 
            {/* Metric 2: Atividades Concluídas */}
            <div className="bg-white border border-[#EDEDEB] p-4 rounded-lg flex items-center gap-3 shadow-2xs relative overflow-hidden group">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded shrink-0 border border-emerald-100">
                <Award size={20} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-[#A4A4A2] uppercase font-bold tracking-wider">Atividades Concluídas</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold text-emerald-600 font-mono tracking-tight">{pctConcluido}%</span>
                  <span className="text-[10px] text-[#A4A4A2] font-medium">({concluidosCount} de {totalFiltered})</span>
                </div>
                <div className="w-full h-1.5 bg-[#F1F1EF] rounded-full mt-2 overflow-hidden border border-[#EDEDEB]">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${pctConcluido}%` }}
                  />
                </div>
              </div>
            </div>
 
            {/* Metric 3: Não Concluídas (Soma de todos exceto concluídos) */}
            <div className="bg-white border border-[#EDEDEB] p-4 rounded-lg flex items-center gap-3 shadow-2xs relative overflow-hidden group">
              <div className="p-3 bg-amber-50 text-amber-600 rounded shrink-0 border border-amber-100">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-[#A4A4A2] uppercase font-bold tracking-wider" title="Soma de Programadas, Reprogramadas e Pendentes (Total menos Concluídas)">Não Concluídas (Em Aberto)</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold text-amber-600 font-mono tracking-tight">{pctNaoConcluidos}%</span>
                  <span className="text-[10px] text-[#A4A4A2] font-medium">({naoConcluidosCount} de {totalFiltered})</span>
                </div>
                <div className="w-full h-1.5 bg-[#F1F1EF] rounded-full mt-2 overflow-hidden border border-[#EDEDEB]">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${pctNaoConcluidos}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Metric 4: Programadas */}
            <div className="bg-white border border-[#EDEDEB] p-4 rounded-lg flex items-center gap-3 shadow-2xs relative overflow-hidden group">
              <div className="p-3 bg-sky-50 text-sky-600 rounded shrink-0 border border-sky-100">
                <Calendar size={20} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-[#A4A4A2] uppercase font-bold tracking-wider">Programadas</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold text-sky-650 font-mono tracking-tight">{pctProgramado}%</span>
                  <span className="text-[10px] text-[#A4A4A2] font-medium">({programadosCount} de {totalFiltered})</span>
                </div>
                <div className="w-full h-1.5 bg-[#F1F1EF] rounded-full mt-2 overflow-hidden border border-[#EDEDEB]">
                  <div 
                    className="bg-sky-500 h-full rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${pctProgramado}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Metric 5: Reprogramadas */}
            <div className="bg-white border border-[#EDEDEB] p-4 rounded-lg flex items-center gap-3 shadow-2xs relative overflow-hidden group">
              <div className="p-3 bg-purple-50 text-purple-600 rounded shrink-0 border border-purple-100">
                <RefreshCw size={20} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-[#A4A4A2] uppercase font-bold tracking-wider">Reprogramadas</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold text-purple-650 font-mono tracking-tight">{pctReprogramado}%</span>
                  <span className="text-[10px] text-[#A4A4A2] font-medium">({reprogramadosCount} de {totalFiltered})</span>
                </div>
                <div className="w-full h-1.5 bg-[#F1F1EF] rounded-full mt-2 overflow-hidden border border-[#EDEDEB]">
                  <div 
                    className="bg-purple-500 h-full rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${pctReprogramado}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Metric 6: Pendentes */}
            <div className="bg-white border border-[#EDEDEB] p-4 rounded-lg flex items-center gap-3 shadow-2xs relative overflow-hidden group">
              <div className="p-3 bg-rose-50 text-rose-600 rounded shrink-0 border border-rose-100">
                <ShieldAlert size={20} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-[#A4A4A2] uppercase font-bold tracking-wider">Pendentes</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold text-rose-600 font-mono tracking-tight">{pctPendente}%</span>
                  <span className="text-[10px] text-[#A4A4A2] font-medium">({pendentesCount} de {totalFiltered})</span>
                </div>
                <div className="w-full h-1.5 bg-[#F1F1EF] rounded-full mt-2 overflow-hidden border border-[#EDEDEB]">
                  <div 
                    className="bg-rose-500 h-full rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${pctPendente}%` }}
                  />
                </div>
              </div>
            </div>
 
            {/* Metric 7: Checklist Interno */}
            <div className="bg-white border border-[#EDEDEB] p-4 rounded-lg flex items-center gap-3 shadow-2xs col-span-1 sm:col-span-2 md:col-span-3 xl:col-span-2">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded shrink-0 border border-indigo-100">
                <CheckSquare size={20} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-[#A4A4A2] uppercase font-bold tracking-wider">Checklist Interno</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-2xl font-bold text-[#37352F] font-mono shrink-0">{taskCompletionRate}%</div>
                  <div className="w-full h-2 bg-[#F1F1EF] rounded-full overflow-hidden border border-[#EDEDEB]">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${taskCompletionRate}%` }}
                    />
                  </div>
                </div>
                <div className="text-[9px] text-[#A4A4A2] font-mono font-medium mt-1">
                  {completedTasks}/{totalTasks} checklists completos
                </div>
              </div>
            </div>
          </div>

          {/* -----------------------------------------------------
              GRAPHS GRID VIEW (2 ROW / GRID STRUCTURE)
             ----------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. COMPLETED VS PENDING (OTHERS) IN-DEPTH AUDIT */}
            <div className="bg-white border border-[#EDEDEB] p-5 rounded-lg shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={15} className="text-[#37352F]" />
                  <h3 className="text-xs font-bold text-[#37352F] uppercase tracking-wider">Percentual Coerente: Conclusão</h3>
                </div>
                <p className="text-[11px] text-[#5A5A57] leading-tight mb-4">
                  Visualização da eficiência e conformidade geral. Mostra a porcentagem final de atividades concluídas em relação a programadas/reprogramadas/pendentes.
                </p>
              </div>

              {completionRatioData.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center justify-around gap-4 bg-[#F7F7F5]/50 p-4 rounded-lg border border-[#EDEDEB]/60">
                  <div className="h-[150px] w-[150px] relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={completionRatioData}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {completionRatioData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Inner percentage graphic display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[20px] font-bold font-mono text-[#37352F] tracking-tight">{pctConcluido}%</span>
                      <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wide">OK</span>
                    </div>
                  </div>

                  {/* Bullet indicators */}
                  <div className="flex-1 space-y-2.5 w-full">
                    {/* Concluído Indicator */}
                    <div className="flex flex-col gap-1 p-2 bg-white rounded border border-[#EDEDEB] shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-[11px] font-bold text-[#37352F]">CONCLUÍDO</span>
                        <span className="text-[10px] font-mono text-[#A4A4A2] ml-auto font-bold">{pctConcluido}%</span>
                      </div>
                      <div className="text-[11px] font-mono text-[#5A5A57] pl-3.5">
                        {concluidosCount} atividade(s) finalizada(s)
                      </div>
                    </div>

                    {/* Não Concluídas Indicator */}
                    <div className="flex flex-col gap-1 p-2 bg-white rounded border border-[#EDEDEB] shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-[11px] font-bold text-[#37352F]">EM ABERTO (NÃO CONCLUÍDOS)</span>
                        <span className="text-[10px] font-mono text-[#A4A4A2] ml-auto font-bold">{pctNaoConcluidos}%</span>
                      </div>
                      <div className="text-[11px] font-mono text-[#5A5A57] pl-3.5">
                        {naoConcluidosCount} atividade(s) não concluída(s) (Soma de Programadas, Reprogramadas e Pendentes)
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[210px] flex items-center justify-center text-xs text-[#A4A4A2] bg-[#F7F7F5] rounded border border-[#EDEDEB]">
                  Sem dados para auditar neste filtro.
                </div>
              )}
            </div>

            {/* 2. SPECIFIC AUDIT BLOCK: COHERENCE REPORT (🟢 OK VS 🔴 X) */}
            <div className="bg-white border border-[#EDEDEB] p-5 rounded-lg shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={15} className="text-[#37352F]" />
                  <h3 className="text-xs font-bold text-[#37352F] uppercase tracking-wider">Quadro de Auditoria & Coerência</h3>
                </div>
                <p className="text-[11px] text-[#5A5A57] leading-tight mb-4">
                  Distribuição para verificação de inconformidades e coerência do cronograma. Indica quantos serviços estão válidos (OK 🟢) ou com anomalias (🔴 X).
                </p>
              </div>

              {/* Progress and compliance gauges */}
              <div className="space-y-3 bg-[#F7F7F5]/50 p-4 rounded-lg border border-[#EDEDEB]/60">
                
                {/* Gauge 1: Coerente OK */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                      <CheckCircle2 size={13} className="stroke-[3px]" />
                      <span>Coerente OK (🟢)</span>
                    </span>
                    <span className="font-mono font-bold text-[#37352F] bg-white px-2 py-0.5 rounded shadow-2xs border border-[#EDEDEB]">
                      {coerenteCount} ({totalFiltered > 0 ? Math.round((coerenteCount / totalFiltered) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-200/60 rounded-md overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-md transition-all duration-500"
                      style={{ width: `${totalFiltered > 0 ? (coerenteCount / totalFiltered) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Gauge 2: Incoerente X */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-red-650">
                      <XCircle size={13} className="stroke-[3px]" />
                      <span>Incoerente (🔴 X)</span>
                    </span>
                    <span className="font-mono font-bold text-[#37352F] bg-white px-2 py-0.5 rounded shadow-2xs border border-[#EDEDEB]">
                      {incoerenteCount} ({totalFiltered > 0 ? Math.round((incoerenteCount / totalFiltered) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-200/60 rounded-md overflow-hidden">
                    <div 
                      className="bg-red-500 h-full rounded-md transition-all duration-500"
                      style={{ width: `${totalFiltered > 0 ? (incoerenteCount / totalFiltered) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Gauge 3: Sem Marcação */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#5A5A57]">
                      <AlertCircle size={13} />
                      <span>Pendente de Auditoria</span>
                    </span>
                    <span className="font-mono font-bold text-[#37352F] bg-white px-2 py-0.5 rounded shadow-2xs border border-[#EDEDEB]">
                      {semControleCount} ({totalFiltered > 0 ? Math.round((semControleCount / totalFiltered) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-200/60 rounded-md overflow-hidden">
                    <div 
                      className="bg-zinc-400 h-full rounded-md transition-all duration-500"
                      style={{ width: `${totalFiltered > 0 ? (semControleCount / totalFiltered) * 100 : 0}%` }}
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* 3. STATUS DISTRIBUTION */}
            <div className="bg-white border border-[#EDEDEB] p-5 rounded-lg shadow-2xs">
              <div className="flex items-center gap-2 mb-5">
                <Activity size={15} className="text-[#A4A4A2]" />
                <h3 className="text-xs font-bold text-[#37352F] uppercase tracking-wider">Distribuição por Status</h3>
              </div>
              {statusData.length > 0 ? (
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} barSize={34}>
                      <XAxis 
                        dataKey="name" 
                        stroke="#A4A4A2" 
                        fontSize={10} 
                        tickLine={false} 
                        fontFamily="Inter, sans-serif"
                        fontWeight="bold"
                      />
                      <YAxis 
                        stroke="#A4A4A2" 
                        fontSize={10} 
                        tickLine={false} 
                        allowDecimals={false} 
                        fontFamily="Inter, sans-serif"
                        fontWeight="bold"
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F7F7F5' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {statusData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-xs text-[#A4A4A2] bg-[#F7F7F5] rounded border border-[#EDEDEB]">Sem dados de status.</div>
              )}
            </div>

            {/* 4. PRIORITY BREAKDOWN */}
            <div className="bg-white border border-[#EDEDEB] p-5 rounded-lg shadow-2xs">
              <div className="flex items-center gap-2 mb-5">
                <PieIcon size={15} className="text-[#A4A4A2]" />
                <h3 className="text-xs font-bold text-[#37352F] uppercase tracking-wider">Análise de Prioridade</h3>
              </div>
              {priorityData.length > 0 ? (
                <div className="h-[240px] w-full flex flex-col sm:flex-row items-center justify-center gap-2">
                  <div className="h-[180px] w-full sm:w-[50%]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={priorityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {priorityData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full sm:w-[50%] flex flex-col gap-2 px-1 justify-center">
                    {priorityData.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs font-sans font-medium text-[#5A5A57] bg-[#F7F7F5] p-2 rounded border border-[#EDEDEB]">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="truncate flex-1 text-[11px] font-bold text-[#37352F]">{entry.name}</span>
                        <span className="text-[11px] font-mono font-bold ml-auto text-[#37352F] bg-white px-2 py-0.5 rounded shadow-sm border border-[#EDEDEB]">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-xs text-[#A4A4A2] bg-[#F7F7F5] rounded border border-[#EDEDEB]">Sem dados de prioridade.</div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
