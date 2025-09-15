import api from './api';

const qualityTestService = {
  // Submeter teste de qualidade
  submitTest: async (testData) => {
    try {
      const response = await api.post('/quality-tests', testData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Buscar testes por máquina
  getTestsByMachine: async (machineId) => {
    try {
      const response = await api.get(`/quality-tests?machineId=${machineId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Buscar teste por ID
  getTestById: async (testId) => {
    try {
      const response = await api.get(`/quality-tests/${testId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default qualityTestService;