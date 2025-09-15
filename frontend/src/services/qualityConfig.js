import api from './api';

const qualityConfigService = {
  // Listar todas as configurações
  async getConfigs(params = {}) {
    const response = await api.get('/quality-test-config', { params });
    return response.data;
  },

  // Obter configuração específica por ID
  async getConfig(id) {
    const response = await api.get(`/quality-test-config/${id}`);
    return response.data;
  },

  // Criar nova configuração
  async createConfig(configData) {
    const response = await api.post('/quality-test-config', configData);
    return response.data;
  },

  // Atualizar configuração existente
  async updateConfig(id, configData) {
    const response = await api.put(`/quality-test-config/${id}`, configData);
    return response.data;
  },

  // Excluir configuração
  async deleteConfig(id) {
    const response = await api.delete(`/quality-test-config/${id}`);
    return response.data;
  },

  // Verificar testes obrigatórios para uma máquina
  async checkRequiredTests(machineId) {
    const response = await api.get(`/quality-test-config/required-tests/${machineId}`);
    return response.data;
  },

  // Obter configurações por máquina
  async getConfigsByMachine(machineId) {
    return this.getConfigs({ machineId, isActive: true });
  },

  // Ativar/desativar configuração
  async toggleConfig(id, isActive) {
    return this.updateConfig(id, { isActive });
  }
};

export default qualityConfigService;