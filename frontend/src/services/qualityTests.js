import api from './api';

export const qualityTestsService = {
  // Obter todos os testes de qualidade
  async getTests(params = {}) {
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.machineId) searchParams.append('machineId', params.machineId);
    if (params.approved !== undefined) searchParams.append('approved', params.approved);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.search) searchParams.append('search', params.search);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/quality-tests?${queryString}` : '/quality-tests';
    
    const response = await api.get(url);
    return response.data;
  },

  // Obter teste específico por ID
  async getTest(id) {
    const response = await api.get(`/quality-tests/${id}`);
    return response.data;
  },

  // Criar novo teste de qualidade
  async createTest(testData) {
    console.log('=== Frontend - Dados originais do formulário ===');
    console.log('testData:', JSON.stringify(testData, null, 2));
    
    // Mapear os dados do formulário para o formato esperado pela API
    const apiData = {
      machineId: parseInt(testData.machineId),
      product: testData.product || 'Produto Padrão',
      lot: testData.lot || `LOT-${Date.now()}`,
      boxNumber: testData.boxNumber || `BOX-${Date.now()}`,
      packageSize: testData.packageSize || 'Médio',
      packageWidth: parseFloat(testData.packageWidth) || 0.25,
      bottomSize: parseFloat(testData.bottomSize) || 10.0,
      sideSize: parseFloat(testData.sideSize) || 15.0,
      zipperDistance: parseFloat(testData.zipperDistance) || 2.0,
      facilitatorDistance: parseFloat(testData.facilitatorDistance) || 1.5,
      rulerTestDone: Boolean(testData.rulerTestDone),
      hermeticityTestDone: Boolean(testData.hermeticityTestDone),
      // Novos campos de inspeção de qualidade
      visualInspection: testData.visualInspection,
      dimensionalCheck: testData.dimensionalCheck,
      colorConsistency: testData.colorConsistency,
      surfaceQuality: testData.surfaceQuality,
      adhesionTest: testData.adhesionTest,
      approved: testData.approved !== null ? Boolean(testData.approved) : true,
      observations: testData.observations || '',
      images: testData.media && testData.media.length > 0 ? testData.media.filter(m => m.type === 'image').map(m => m.name || 'image.jpg') : ['placeholder-image.jpg'],
      videos: testData.media && testData.media.length > 0 ? testData.media.filter(m => m.type === 'video').map(m => m.name || 'video.mp4') : []
    };

    console.log('=== Frontend - Dados enviados para API ===');
    console.log('apiData:', JSON.stringify(apiData, null, 2));

    const response = await api.post('/quality-tests', apiData);
    return response.data;
  },

  // Atualizar teste existente
  async updateTest(id, testData) {
    const response = await api.put(`/quality-tests/${id}`, testData);
    return response.data;
  },

  // Deletar teste
  async deleteTest(id) {
    const response = await api.delete(`/quality-tests/${id}`);
    return response.data;
  },

  // Obter estatísticas dos testes
  async getStats(params = {}) {
    const searchParams = new URLSearchParams();
    
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.machineId) searchParams.append('machineId', params.machineId);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/quality-tests/stats/summary?${queryString}` : '/quality-tests/stats/summary';
    
    const response = await api.get(url);
    return response.data;
  },

  // Upload de imagens para teste
  async uploadImages(testId, files) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });
    formData.append('testId', testId);
    
    const response = await api.post('/quality-tests/upload-images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Upload de vídeos para teste
  async uploadVideos(testId, files) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('videos', file);
    });
    formData.append('testId', testId);
    
    const response = await api.post('/quality-tests/upload-videos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};

export default qualityTestsService;