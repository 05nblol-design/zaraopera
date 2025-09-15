import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, Save, ArrowLeft } from 'lucide-react';
import { qualityTestService, machineService } from '../services/api';
import toast from 'react-hot-toast';

const QualityTest = () => {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testData, setTestData] = useState({
    product: '',
    lot: '',
    box_number: '',
    package_size: '',
    package_width: '',
    bottom_size: '',
    side_size: '',
    zipper_distance: '',
    facilitator_distance: '',
    ruler_test_done: false,
    hermeticity_test_done: false,
    visual_inspection: null,
    dimensional_check: null,
    color_consistency: null,
    surface_quality: null,
    adhesion_test: null,
    observations: '',
    approved: null
  });

  const qualityChecks = [
    { key: 'visual_inspection', label: 'Inspeção Visual' },
    { key: 'dimensional_check', label: 'Verificação Dimensional' },
    { key: 'color_consistency', label: 'Consistência de Cor' },
    { key: 'surface_quality', label: 'Qualidade da Superfície' },
    { key: 'adhesion_test', label: 'Teste de Adesão' }
  ];

  useEffect(() => {
    loadMachine();
  }, [machineId]);

  const loadMachine = async () => {
    try {
      const response = await machineService.getById(machineId);
      if (response.data) {
        setMachine(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar máquina:', error);
      toast.error('Erro ao carregar dados da máquina');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setTestData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleQualityCheck = (check, value) => {
    setTestData(prev => ({
      ...prev,
      [check]: value
    }));
  };

  const handleSubmit = async (approved) => {
    if (!testData.product.trim()) {
      toast.error('Produto é obrigatório');
      return;
    }

    if (!testData.lot.trim()) {
      toast.error('Lote é obrigatório');
      return;
    }

    if (!testData.box_number.trim()) {
      toast.error('Número da caixa é obrigatório');
      return;
    }

    setSubmitting(true);
    try {
      const submitData = {
        machineId: parseInt(machineId),
        product: testData.product,
        lot: testData.lot,
        boxNumber: testData.box_number,
        packageSize: testData.package_size,
        packageWidth: parseFloat(testData.package_width) || 0,
        bottomSize: parseFloat(testData.bottom_size) || 0,
        sideSize: parseFloat(testData.side_size) || 0,
        zipperDistance: parseFloat(testData.zipper_distance) || 0,
        facilitatorDistance: parseFloat(testData.facilitator_distance) || 0,
        rulerTestDone: testData.ruler_test_done,
        hermeticityTestDone: testData.hermeticity_test_done,
        visualInspection: testData.visual_inspection,
        dimensionalCheck: testData.dimensional_check,
        colorConsistency: testData.color_consistency,
        surfaceQuality: testData.surface_quality,
        adhesionTest: testData.adhesion_test,
        observations: testData.observations,
        approved,
        isRequired: true // Marcado como obrigatório pois veio do sistema de produção
      };

      const response = await qualityTestService.create(submitData);
      
      if (response.data) {
        toast.success(`Teste ${approved ? 'aprovado' : 'reprovado'} com sucesso!`);
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Erro ao salvar teste:', error);
      toast.error('Erro ao salvar teste de qualidade');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Teste de Qualidade
                </h1>
                <p className="text-gray-600">
                  Máquina: {machine?.name || `ID ${machineId}`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-amber-600 font-medium">
                Teste Obrigatório
              </span>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Informações do Produto */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informações do Produto
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Produto *
                </label>
                <input
                  type="text"
                  value={testData.product}
                  onChange={(e) => handleInputChange('product', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome do produto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lote *
                </label>
                <input
                  type="text"
                  value={testData.lot}
                  onChange={(e) => handleInputChange('lot', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Número do lote"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número da Caixa *
                </label>
                <input
                  type="text"
                  value={testData.box_number}
                  onChange={(e) => handleInputChange('box_number', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Número da caixa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tamanho da Embalagem
                </label>
                <input
                  type="text"
                  value={testData.package_size}
                  onChange={(e) => handleInputChange('package_size', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tamanho da embalagem"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={testData.observations}
                  onChange={(e) => handleInputChange('observations', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Observações adicionais"
                />
              </div>
            </div>

            {/* Medições e Testes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Medições e Testes
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Largura da Embalagem (mm)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={testData.package_width}
                    onChange={(e) => handleInputChange('package_width', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tamanho do Fundo (mm)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={testData.bottom_size}
                    onChange={(e) => handleInputChange('bottom_size', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tamanho Lateral (mm)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={testData.side_size}
                    onChange={(e) => handleInputChange('side_size', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Distância do Zíper (mm)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={testData.zipper_distance}
                    onChange={(e) => handleInputChange('zipper_distance', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Distância do Facilitador (mm)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={testData.facilitator_distance}
                    onChange={(e) => handleInputChange('facilitator_distance', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Testes Realizados */}
              <div className="space-y-3">
                <h4 className="text-md font-medium text-gray-800">Testes Realizados</h4>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={testData.ruler_test_done}
                      onChange={(e) => handleInputChange('ruler_test_done', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Teste com Régua</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={testData.hermeticity_test_done}
                      onChange={(e) => handleInputChange('hermeticity_test_done', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Teste de Hermeticidade</span>
                  </label>
                </div>
              </div>

              {/* Verificações de Qualidade */}
              <div className="space-y-3">
                <h4 className="text-md font-medium text-gray-800">Verificações de Qualidade</h4>
                <div className="space-y-3">
                  {qualityChecks.map(check => (
                    <div key={check.key} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {check.label}
                      </label>
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name={check.key}
                            value="true"
                            checked={testData[check.key] === true}
                            onChange={() => handleQualityCheck(check.key, true)}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                          />
                          <span className="ml-2 text-sm text-green-700">Aprovado</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name={check.key}
                            value="false"
                            checked={testData[check.key] === false}
                            onChange={() => handleQualityCheck(check.key, false)}
                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                          />
                          <span className="ml-2 text-sm text-red-700">Reprovado</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="mt-8 flex justify-end space-x-4">
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center space-x-2"
            >
              <XCircle className="h-4 w-4" />
              <span>{submitting ? 'Salvando...' : 'Reprovar'}</span>
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center space-x-2"
            >
              <CheckCircle className="h-4 w-4" />
              <span>{submitting ? 'Salvando...' : 'Aprovar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityTest;