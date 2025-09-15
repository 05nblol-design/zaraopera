import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';
import ShiftRotation3x3 from '../components/ShiftRotation3x3';

const ShiftManagement3x3 = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [newTeam, setNewTeam] = useState({
    code: '',
    members: []
  });

  useEffect(() => {
    loadTeams();
    loadUsers();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/shifts/3x3/teams');
      if (response.data.success) {
        setTeams(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar equipes:', error);
      setError('Erro ao carregar equipes');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      if (response.data.success) {
        // Filtrar apenas operadores e líderes
        const availableUsers = response.data.data.filter(
          user => user.role === 'OPERATOR' || user.role === 'LEADER'
        );
        setUsers(availableUsers);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeam.code || newTeam.members.length === 0) {
      setError('Código da equipe e pelo menos um membro são obrigatórios');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/shifts/3x3/initialize-teams', {
        teams: [{
          code: newTeam.code,
          members: newTeam.members
        }]
      });
      
      if (response.data.success) {
        setSuccess('Equipe criada com sucesso!');
        setShowCreateTeam(false);
        setNewTeam({ code: '', members: [] });
        loadTeams();
      }
    } catch (error) {
      console.error('Erro ao criar equipe:', error);
      setError('Erro ao criar equipe: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const addMemberToTeam = (userId, isLeader = false) => {
    const user = users.find(u => u.id === parseInt(userId));
    if (user && !newTeam.members.find(m => m.userId === user.id)) {
      setNewTeam(prev => ({
        ...prev,
        members: [...prev.members, { userId: user.id, isLeader, user }]
      }));
    }
  };

  const removeMemberFromTeam = (userId) => {
    setNewTeam(prev => ({
      ...prev,
      members: prev.members.filter(m => m.userId !== userId)
    }));
  };

  const toggleLeader = (userId) => {
    setNewTeam(prev => ({
      ...prev,
      members: prev.members.map(m => 
        m.userId === userId ? { ...m, isLeader: !m.isLeader } : m
      )
    }));
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const tabs = [
    { id: 'overview', name: 'Visão Geral', icon: Users },
    { id: 'teams', name: 'Gerenciar Equipes', icon: Edit }
  ];

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gerenciamento de Turnos 3x3</h1>
        <p className="text-gray-600 mt-2">
          Sistema de rotação com 4 escalas: 3 dias trabalhando, 3 dias de folga
        </p>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <span className="text-red-700">{error}</span>
          </div>
          <button onClick={clearMessages} className="text-red-500 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="text-green-500 mr-2" size={20} />
            <span className="text-green-700">{success}</span>
          </div>
          <button onClick={clearMessages} className="text-green-500 hover:text-green-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="mr-2" size={16} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo das Tabs */}
      {activeTab === 'overview' && (
        <ShiftRotation3x3 />
      )}

      {activeTab === 'teams' && (
        <div className="space-y-6">
          {/* Botão Criar Equipe */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Equipes Cadastradas</h2>
            <button
              onClick={() => setShowCreateTeam(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
            >
              <Plus className="mr-2" size={16} />
              Nova Equipe
            </button>
          </div>

          {/* Lista de Equipes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => (
              <div key={team.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">{team.teamCode}</h3>
                  <span className="text-sm text-gray-500">Ciclo {team.currentCycle}</span>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <strong>Membros:</strong> {team.members.length}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Líderes:</strong> {team.members.filter(m => m.isLeader).length}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Criado em:</strong> {new Date(team.cycleStartDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Membros:</h4>
                  <div className="space-y-1">
                    {team.members.slice(0, 3).map(member => (
                      <div key={member.id} className="flex items-center text-sm">
                        <span className={`w-2 h-2 rounded-full mr-2 ${
                          member.isLeader ? 'bg-yellow-400' : 'bg-green-400'
                        }`}></span>
                        <span className="text-gray-600">
                          {member.user.name} {member.isLeader && '(Líder)'}
                        </span>
                      </div>
                    ))}
                    {team.members.length > 3 && (
                      <p className="text-xs text-gray-500">+{team.members.length - 3} mais...</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {teams.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma equipe cadastrada</h3>
              <p className="mt-1 text-sm text-gray-500">
                Crie a primeira equipe para começar a usar o sistema 3x3.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal Criar Equipe */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Criar Nova Equipe</h3>
              <button
                onClick={() => setShowCreateTeam(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Código da Equipe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código da Equipe
                </label>
                <input
                  type="text"
                  value={newTeam.code}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="Ex: EQUIPE_A, TURNO_1, etc."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Adicionar Membros */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adicionar Membro
                </label>
                <div className="flex space-x-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addMemberToTeam(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um usuário...</option>
                    {users
                      .filter(user => !newTeam.members.find(m => m.userId === user.id))
                      .map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role})
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>

              {/* Lista de Membros */}
              {newTeam.members.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Membros da Equipe ({newTeam.members.length})
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {newTeam.members.map(member => (
                      <div key={member.userId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center">
                          <span className="font-medium">{member.user.name}</span>
                          <span className="text-sm text-gray-500 ml-2">({member.user.role})</span>
                          {member.isLeader && (
                            <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                              Líder
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleLeader(member.userId)}
                            className={`px-2 py-1 text-xs rounded ${
                              member.isLeader
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {member.isLeader ? 'Remover Liderança' : 'Tornar Líder'}
                          </button>
                          <button
                            onClick={() => removeMemberFromTeam(member.userId)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateTeam(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={loading || !newTeam.code || newTeam.members.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Save className="mr-2" size={16} />
                )}
                Criar Equipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftManagement3x3;