import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  CogIcon,
  BeakerIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  BellIcon,
  EyeIcon,
  PlusIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '../hooks/useAuth';
import useMachineStatus from '../hooks/useMachineStatus';
import { useNotifications } from '../contexts/NotificationContext';
import { useMachinePermissions } from '../hooks/useMachinePermissions';

// Utilitários
import { cn, formatNumber, formatDateTime } from '../lib/utils';
import { ROUTES } from '../config/routes';
import api from '../services/api';

const OperatorMenu = () => {
  const { user } = useAuth();
  const { machines, stats } = useMachineStatus();
  const { notifications } = useNotifications();
  const { filterMachinesByPermissions } = useMachinePermissions();
  
  const [recentTests, setRecentTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myMachines, setMyMachines] = useState([]);

  // Filtrar máquinas que o operador pode acessar
  useEffect(() => {
    if (machines && machines.length > 0) {
      const accessibleMachines = filterMachinesByPermissions(machines, 'canOperate');
      setMyMachines(accessibleMachines);
    }
  }, [machines, filterMachinesByPermissions]);

  // Buscar testes recentes do operador
  useEffect(() => {
    fetchRecentTests();
  }, []);

  const fetchRecentTests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/quality-tests?limit=5&userId=' + user?.id);
      if (response.data.success) {
        setRecentTests(response.data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar testes recentes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Estatísticas das máquinas acessíveis
  const myMachineStats = {
    total: myMachines.length,
    running: myMachines.filter(m => m.status === 'RUNNING').length,
    stopped: myMachines.filter(m => m.status === 'STOPPED').length,
    maintenance: myMachines.filter(m => m.status === 'MAINTENANCE').length
  };

  // Notificações recentes
  const recentNotifications = (notifications || []).slice(0, 3);

  const menuItems = [
    {
      title: 'Minhas Máquinas',
      description: 'Visualizar e operar máquinas autorizadas',
      icon: CogIcon,
      path: ROUTES.MACHINES,
      color: 'blue',
      stats: `${myMachineStats.running}/${myMachineStats.total} operando`
    },
    {
      title: 'Teste de Qualidade',
      description: 'Realizar novos testes de qualidade',
      icon: BeakerIcon,
      path: ROUTES.QUALITY_NEW,
      color: 'green',
      stats: 'Criar novo teste'
    },
    {
      title: 'Histórico de Testes',
      description: 'Visualizar testes realizados',
      icon: CheckCircleIcon,
      path: ROUTES.QUALITY,
      color: 'purple',
      stats: `${recentTests.length} testes recentes`
    },
    {
      title: 'Troca de Teflon',
      description: 'Registrar trocas de teflon',
      icon: ShieldCheckIcon,
      path: ROUTES.TEFLON,
      color: 'orange',
      stats: 'Registrar troca'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-500 text-white',
      green: 'bg-green-500 text-white',
      purple: 'bg-purple-500 text-white',
      orange: 'bg-orange-500 text-white'
    };
    return colors[color] || colors.blue;
  };

  const getHoverClasses = (color) => {
    const colors = {
      blue: 'hover:bg-blue-600',
      green: 'hover:bg-green-600',
      purple: 'hover:bg-purple-600',
      orange: 'hover:bg-orange-600'
    };
    return colors[color] || colors.blue;
  };

  return (
    <>
      <Helmet>
        <title>Menu do Operador - ZARA</title>
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Bem-vindo, {user?.name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Menu do Operador - Sistema ZARA
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <UserIcon className="h-4 w-4" />
                  <span>Operador</span>
                </div>
                {recentNotifications.length > 0 && (
                  <div className="flex items-center space-x-2 text-sm text-orange-600 dark:text-orange-400">
                    <BellIcon className="h-4 w-4" />
                    <span>{recentNotifications.length} notificações</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <CogIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Minhas Máquinas
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {myMachineStats.total}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Operando
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {myMachineStats.running}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <BeakerIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Testes Hoje
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {recentTests.length}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <BellIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Notificações
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {recentNotifications.length}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Menu Principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    to={item.path}
                    className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className={cn(
                          'p-3 rounded-lg',
                          getColorClasses(item.color),
                          getHoverClasses(item.color),
                          'group-hover:scale-110 transition-transform duration-200'
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {item.description}
                      </p>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-500">
                        {item.stats}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Seções Adicionais */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Máquinas Recentes */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Minhas Máquinas
                  </h3>
                  <Link
                    to={ROUTES.MACHINES}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                  >
                    <span>Ver todas</span>
                    <EyeIcon className="h-4 w-4" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {myMachines.slice(0, 4).map((machine) => (
                    <div key={machine.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          'w-3 h-3 rounded-full',
                          machine.status === 'RUNNING' ? 'bg-green-500' :
                          machine.status === 'STOPPED' ? 'bg-red-500' :
                          machine.status === 'MAINTENANCE' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        )} />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {machine.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {machine.code}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        machine.status === 'RUNNING' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                        machine.status === 'STOPPED' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                        machine.status === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                      )}>
                        {machine.status === 'RUNNING' ? 'Operando' :
                         machine.status === 'STOPPED' ? 'Parada' :
                         machine.status === 'MAINTENANCE' ? 'Manutenção' :
                         'Desconhecido'}
                      </span>
                    </div>
                  ))}
                  {myMachines.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      Nenhuma máquina autorizada
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Ações Rápidas */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Ações Rápidas
                </h3>
                <div className="space-y-3">
                  <Link
                    to={ROUTES.QUALITY_NEW}
                    className="flex items-center space-x-3 p-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Novo Teste de Qualidade</span>
                  </Link>
                  
                  <Link
                    to={ROUTES.TEFLON}
                    className="flex items-center space-x-3 p-3 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                  >
                    <ShieldCheckIcon className="h-4 w-4" />
                    <span>Registrar Troca de Teflon</span>
                  </Link>
                  
                  <Link
                    to={ROUTES.MACHINES}
                    className="flex items-center space-x-3 p-3 text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  >
                    <CogIcon className="h-4 w-4" />
                    <span>Verificar Máquinas</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OperatorMenu;