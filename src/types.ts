export type StatusType = 'PROGRAMADO' | 'REPROGRAMADO' | 'CONCLUIDO' | 'PENDENTE';
export type PriorityType = 'Alta' | 'Media' | 'Baixa';

export function normalizeStatus(status: any): StatusType {
  if (!status) return 'PROGRAMADO';
  const upperStatus = String(status).toUpperCase().trim();
  if (upperStatus === 'EM ANDAMENTO' || upperStatus === 'EM_ANDAMENTO') {
    return 'REPROGRAMADO';
  }
  if (upperStatus === 'CANCELADO' || upperStatus === 'CANCELADA') {
    return 'PENDENTE';
  }
  if (
    upperStatus === 'CONCLUIDO' || 
    upperStatus === 'CONCLUÍDO' || 
    upperStatus === 'CONCLUIDA' || 
    upperStatus === 'CONCLUÍDA' ||
    upperStatus === 'CONCLUÍDOS' ||
    upperStatus === 'CONCLUIDOS'
  ) {
    return 'CONCLUIDO';
  }
  if (upperStatus === 'PROGRAMADO' || upperStatus === 'PROGRAMADA') {
    return 'PROGRAMADO';
  }
  if (upperStatus === 'REPROGRAMADO' || upperStatus === 'REPROGRAMADA') {
    return 'REPROGRAMADO';
  }
  if (upperStatus === 'PENDENTE' || upperStatus === 'PENDENTES') {
    return 'PENDENTE';
  }
  if (upperStatus === 'PROGRAMADO' || upperStatus === 'REPROGRAMADO' || upperStatus === 'CONCLUIDO' || upperStatus === 'PENDENTE') {
    return upperStatus as StatusType;
  }
  return 'PROGRAMADO';
}

export function getWeekNumber(dateString: string): number {
  if (!dateString) return 1;
  const dateParts = dateString.split('-');
  if (dateParts.length !== 3) return 1;
  const year = Number(dateParts[0]);
  const month = Number(dateParts[1]) - 1;
  const day = Number(dateParts[2]);
  
  const target = new Date(year, month, day);
  const oneJan = new Date(year, 0, 1);
  const millisecondsInDay = 86400000;
  
  // Calculate day of year relative to Jan 1st
  const diffTime = target.getTime() - oneJan.getTime();
  const dayOfYear = (diffTime / millisecondsInDay) + oneJan.getDay() + 1;
  
  const weekNum = Math.ceil(dayOfYear / 7);
  return isNaN(weekNum) || weekNum <= 0 ? 1 : Math.min(weekNum, 53);
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

export interface AgendaItem {
  id: string;
  title: string;
  semana: number;
  date: string; // YYYY-MM-DD
  status: StatusType;
  quant: number | null;
  priority: PriorityType;
  location: LocationData | null;
  tasks: Task[];
  photos: string[]; // List of base64 images or uploaded links
  notes: string;
  createdAt: any; // Firestore serverTimestamp or string for offline fallback
  updatedAt: any;
  ownerId: string;
  isPublic?: boolean;
  orderIndex?: number;
  coerenteOk?: boolean;
  incoerenteX?: boolean;
}

export interface ColumnConfig {
  id: 'title' | 'date' | 'semana' | 'status' | 'coerente' | 'quant' | 'priority';
  title: string;
  alignment: 'left' | 'center' | 'right';
  format?: 'default' | 'uppercase' | 'lowercase' | 'iso' | 'friendly' | 'full' | 'friendly_short' | 'emoji_text' | 'text_only' | 'emoji_only';
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
}

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'title', title: 'SI/OSE/AL', alignment: 'left', format: 'default' },
  { id: 'date', title: 'Data', alignment: 'left', format: 'default' },
  { id: 'semana', title: '# SEMANA', alignment: 'left', prefix: '', suffix: '' },
  { id: 'status', title: 'STATUS', alignment: 'left', format: 'default' },
  { id: 'coerente', title: 'COERÊNCIA (OK/X)', alignment: 'center', format: 'default' },
  { id: 'quant', title: 'QUANT', alignment: 'left', decimalPlaces: 0, prefix: '', suffix: '' },
  { id: 'priority', title: 'PRIORIDADE', alignment: 'left', format: 'emoji_text' }
];
