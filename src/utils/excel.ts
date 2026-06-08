import * as XLSX from 'xlsx';
import { AgendaItem, StatusType, PriorityType, normalizeStatus, getWeekNumber } from '../types';

// Map database fields to user-friendly Excel column headers
const COLUMN_MAPPINGS = [
  { key: 'title', label: 'SI/OSE/AL (Título)' },
  { key: 'date', label: 'Data (AAAA-MM-DD)' },
  { key: 'semana', label: '# Semana' },
  { key: 'status', label: 'Status (PROGRAMADO/REPROGRAMADO/CONCLUIDO/PENDENTE)' },
  { key: 'coerenteOk', label: 'Coerente OK (Sim/Não)' },
  { key: 'incoerenteX', label: 'Incoerente X (Sim/Não)' },
  { key: 'quant', label: 'Quantidade' },
  { key: 'priority', label: 'Prioridade (Alta/Media/Baixa)' },
  { key: 'notes', label: 'Notas' }
];

/**
 * Trigger browser download of an Excel spreadsheet representing the current schedule item list.
 */
export function exportToExcel(items: AgendaItem[], filename = 'atividades_cronograma.xlsx') {
  // Map items to records with friendly column labels
  const dataToExport = items.map(item => {
    return {
      'SI/OSE/AL (Título)': item.title || '',
      'Data (AAAA-MM-DD)': item.date || '',
      '# Semana': item.semana ?? '',
      'Status (PROGRAMADO/REPROGRAMADO/CONCLUIDO/PENDENTE)': item.status || 'PROGRAMADO',
      'Coerente OK (Sim/Não)': item.coerenteOk ? 'Sim' : 'Não',
      'Incoerente X (Sim/Não)': item.incoerenteX ? 'Sim' : 'Não',
      'Quantidade': item.quant ?? '',
      'Prioridade (Alta/Media/Baixa)': item.priority || 'Media',
      'Notas': item.notes || ''
    };
  });

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(dataToExport);

  // Set column widths dynamically for readability
  const max_cols = COLUMN_MAPPINGS.map(m => m.label.length);
  worksheet['!cols'] = max_cols.map(w => ({ wch: Math.max(w + 3, 12) }));

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cronograma');

  // Generate XLSx output and trigger download
  XLSX.writeFile(workbook, filename);
}

/**
 * Parses selected Excel file data and converts rows back into AgendaItem array.
 */
export async function parseExcelFile(file: File, currentUserId: string): Promise<Partial<AgendaItem>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('Não foi possível ler os dados do arquivo Excel.');
        }

        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Parse to JSON containing raw objects
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);
        const parsedItems: Partial<AgendaItem>[] = [];

        for (const row of rawRows) {
          // Find fields by checking similar matches or known labels
          let title = '';
          let dateStr = '';
          let semanaVal: number | null = null;
          let statusVal: StatusType = 'PROGRAMADO';
          let coerenteOkVal = false;
          let incoerenteXVal = false;
          let quantVal: number | null = null;
          let priorityVal: PriorityType = 'Media';
          let notesStr = '';

          // Loop row keys to find matches
          for (const key of Object.keys(row)) {
            const cleanKey = key.toLowerCase().trim();
            const val = row[key];

            if (cleanKey.includes('si/ose') || cleanKey.includes('titulo') || cleanKey.includes('título')) {
              title = String(val).trim();
            } else if (cleanKey.includes('data')) {
              if (val instanceof Date) {
                // Format Date object to YYYY-MM-DD
                const yyyy = val.getFullYear();
                const mm = String(val.getMonth() + 1).padStart(2, '0');
                const dd = String(val.getDate()).padStart(2, '0');
                dateStr = `${yyyy}-${mm}-${dd}`;
              } else if (val) {
                // If it is stored as serial or string, strip/try to convert
                const stringVal = String(val).trim();
                if (stringVal.includes('/')) {
                  // e.g. DD/MM/YYYY
                  const parts = stringVal.split('/');
                  if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                    dateStr = `${year}-${month}-${day}`;
                  }
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(stringVal)) {
                  dateStr = stringVal;
                } else {
                  dateStr = stringVal;
                }
              }
            } else if (cleanKey.includes('semana')) {
              const num = Number(val);
              if (!isNaN(num)) semanaVal = num;
            } else if (cleanKey.includes('status')) {
              statusVal = normalizeStatus(val);
            } else if (cleanKey.includes('coerente')) {
              const lowerVal = String(val).toLowerCase().trim();
              coerenteOkVal = lowerVal === 'sim' || lowerVal === 'true' || lowerVal === '1' || val === true;
            } else if (cleanKey.includes('incoerente')) {
              const lowerVal = String(val).toLowerCase().trim();
              incoerenteXVal = lowerVal === 'sim' || lowerVal === 'true' || lowerVal === '1' || val === true;
            } else if (cleanKey.includes('quant')) {
              const num = Number(val);
              if (!isNaN(num)) quantVal = num;
            } else if (cleanKey.includes('prioridade')) {
              const normprio = String(val).toLowerCase().trim();
              if (normprio.includes('alta') || normprio.includes('alta 🔴')) {
                priorityVal = 'Alta';
              } else if (normprio.includes('baixa') || normprio.includes('baixa ⚪')) {
                priorityVal = 'Baixa';
              } else {
                priorityVal = 'Media';
              }
            } else if (cleanKey.includes('nota') || cleanKey.includes('observa')) {
              notesStr = String(val).trim();
            }
          }

          // If date exists but week number doesn't, calculate automatically
          if (dateStr && !semanaVal) {
            semanaVal = getWeekNumber(dateStr);
          }

          // Generate randomized short UUID
          const uniqueId = 'import_' + Math.random().toString(36).substring(2, 11);

          parsedItems.push({
            id: uniqueId,
            title: title || 'Atividade Importada',
            semana: semanaVal || 1,
            date: dateStr || new Date().toISOString().split('T')[0],
            status: statusVal,
            coerenteOk: coerenteOkVal,
            incoerenteX: incoerenteXVal,
            quant: quantVal,
            priority: priorityVal,
            location: null,
            tasks: [],
            photos: [],
            notes: notesStr,
            ownerId: currentUserId
          });
        }

        resolve(parsedItems);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => {
      reject(new Error('Erro no leitor de arquivos: ' + err.toString()));
    };

    reader.readAsBinaryString(file);
  });
}
