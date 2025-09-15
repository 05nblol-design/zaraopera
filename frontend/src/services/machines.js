import { machineService } from './api';

// Re-exportar o serviço de máquinas para compatibilidade
export const machinesService = machineService;

// Exportar como default também
export default machineService;