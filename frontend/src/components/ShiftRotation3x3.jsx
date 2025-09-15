import React, { useState, useEffect } from 'react';
import { Clock, Users, Calendar, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';

const ShiftRotation3x3 = () => {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [currentShift, setCurrentShift] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Configuração das escalas
  const SHIFT_CONFIG = {
    SHIFT_1: { name: '1ª Escala Diurna', time: '07:00 - 19:00', color: 'bg-blue-500' },
    SHIFT_2: { name: '1ª Escala Noturna', time: '19:00 - 07:00', color: 'bg-purple-500' },
    SHIFT_3: { name: '2ª Escala Diurna', time: '07:00 - 19:00', color: 'bg-green-500' },
    SHIFT_4: { name: '2ª Escala Noturna', time: '19:00 - 07:00', color: 'bg-orange-500' },
    REST: { name: 'Descanso', time: 'Folga', color: 'bg-gray-400' }
  };

  useEffect(() => {
    loadTeams();
    loadSummary();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadCurrentShift();
      loadSchedule();
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/shifts/3x3/teams');
      if (response.data.success) {
        setTeams(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedTeam(response.data.data[0].teamCode);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar equipes:', error);
      setError('Erro ao carregar equipes');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentShift = async () => {
    if (!selectedTeam) return;
    
    try {
      const response = await api.get(`/shifts/3x3/current/${selectedTeam}`);
      if (response.data.success) {
        setCurrentShift(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar escala atual:', error);
      setError('Erro ao carregar escala atual');
    }
  };

  const loadSchedule = async () => {
    if (!selectedTeam) return;
    
    try {
      const response = await api.get(`/shifts/3x3/schedule/${selectedTeam}?days=14`);
      if (response.data.success) {
        setSchedule(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar cronograma:', error);
      setError('Erro ao carregar cronograma');
    }
  };

  const loadSummary = async () => {
    try {
      const response = await api.get('/shifts/3x3/summary');
      if (response.data.success) {
        setSummary(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'short', 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  const getShiftConfig = (shiftType) => {
    return SHIFT_CONFIG[shiftType] || SHIFT_CONFIG.REST;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Carregando sistema de turnos 3x3...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <RotateCcw className="mr-2" />
              Sistema de Turnos 3x3
            </h2>
            <p className="text-gray-600 mt-1">
              4 escalas em rotação: 3 dias trabalhando, 3 dias de folga
            </p>
          </div>
          
          {/* Seletor de Equipe */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Equipe:</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {teams.map(team => (
                <option key={team.id} value={team.teamCode}>
                  {team.teamCode} ({team.members.length} membros)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="text-red-500 mr-2" size={20} />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Escala Atual */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Clock className="mr-2" />
            Escala Atual - {selectedTeam}
          </h3>
          
          {currentShift ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg text-white ${getShiftConfig(currentShift.currentShift).color}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-lg">
                      {getShiftConfig(currentShift.currentShift).name}
                    </h4>
                    <p className="opacity-90">
                      {getShiftConfig(currentShift.currentShift).time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Dia do Ciclo</p>
                    <p className="text-2xl font-bold">{currentShift.cycleDay}/12</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-semibold flex items-center justify-center">
                    {currentShift.isWorkDay ? (
                      <><CheckCircle className="text-green-500 mr-1" size={16} /> Trabalhando</>
                    ) : (
                      <><AlertCircle className="text-gray-500 mr-1" size={16} /> Descanso</>
                    )}
                  </p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Membros Ativos</p>
                  <p className="font-semibold">{currentShift.members?.length || 0}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Selecione uma equipe para ver a escala atual</p>
          )}
        </div>

        {/* Resumo de Eficiência */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Users className="mr-2" />
            Eficiência por Escala
          </h3>
          
          <div className="space-y-3">
            {summary.length > 0 ? (
              summary.map(item => {
                const config = getShiftConfig(item.shiftType);
                return (
                  <div key={item.shiftType} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full ${config.color} mr-3`}></div>
                      <div>
                        <p className="font-medium">{config.name}</p>
                        <p className="text-sm text-gray-600">{item.shiftsCount} turnos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{item.averageEfficiency}%</p>
                      <p className="text-sm text-gray-600">
                        {item.totalProduction}/{item.totalTarget}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500">Nenhum dado de eficiência disponível</p>
            )}
          </div>
        </div>
      </div>

      {/* Cronograma de Rotação */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Calendar className="mr-2" />
          Cronograma de Rotação - Próximos 14 dias
        </h3>
        
        {schedule.length > 0 ? (
          <div className="grid grid-cols-7 gap-2">
            {schedule.map((day, index) => {
              const config = getShiftConfig(day.shift);
              const isToday = new Date(day.date).toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg text-center border-2 ${
                    isToday ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent'
                  }`}
                >
                  <div className="text-xs text-gray-600 mb-1">
                    {formatDate(day.date)}
                  </div>
                  <div className={`p-2 rounded text-white text-xs ${config.color}`}>
                    <div className="font-semibold">
                      {day.shift === 'REST' ? 'Folga' : day.shift.replace('SHIFT_', '')}
                    </div>
                    <div className="text-xs opacity-90">
                      Dia {day.cycleDay}
                    </div>
                  </div>
                  {day.shiftTimes && (
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(day.shiftTimes.startTime).toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">Selecione uma equipe para ver o cronograma</p>
        )}
      </div>
    </div>
  );
};

export default ShiftRotation3x3;