import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarDaysIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  DocumentTextIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '@/hooks/useAuth';

// Componentes
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Buscar dados do usuário
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`/api/users/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Erro ao carregar dados do usuário');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setUserData(data.data);
        } else {
          throw new Error(data.message || 'Erro ao carregar dados do usuário');
        }
      } catch (err) {
        setError('Erro ao carregar dados do usuário');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [id]);

  const getRoleConfig = (role) => {
    const configs = {
      ADMIN: {
        label: 'Administrador',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
        icon: ShieldCheckIcon,
        iconColor: 'text-purple-600 dark:text-purple-400'
      },
      MANAGER: {
        label: 'Gerente',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        icon: UserIcon,
        iconColor: 'text-blue-600 dark:text-blue-400'
      },
      LEADER: {
        label: 'Líder',
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        icon: UserIcon,
        iconColor: 'text-green-600 dark:text-green-400'
      },
      OPERATOR: {
        label: 'Operador',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        icon: UserIcon,
        iconColor: 'text-gray-600 dark:text-gray-400'
      }
    };
    return configs[role] || configs.OPERATOR;
  };

  const formatDateTime = (date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {error || 'Usuário não encontrado'}
          </h3>
          <Link
            to="/users"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Voltar aos Usuários
          </Link>
        </div>
      </div>
    );
  }

  const roleConfig = getRoleConfig(userData.role);
  const RoleIcon = roleConfig.icon;

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: UserIcon },
    { id: 'activity', label: 'Atividades', icon: ChartBarIcon },
    { id: 'history', label: 'Histórico', icon: DocumentTextIcon }
  ];

  return (
    <>
      <Helmet>
        <title>{userData.name} - Detalhes do Usuário - Sistema ZARA</title>
        <meta name="description" content={`Detalhes do usuário ${userData.name}`} />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/users')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {userData.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {userData.email}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
              roleConfig.color
            )}>
              <RoleIcon className={cn("h-3 w-3 mr-1", roleConfig.iconColor)} />
              {roleConfig.label}
            </span>
            <span className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
              userData.isActive
                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
            )}>
              {userData.isActive ? (
                <CheckCircleIcon className="h-3 w-3 mr-1" />
              ) : (
                <XCircleIcon className="h-3 w-3 mr-1" />
              )}
              {userData.isActive ? 'Ativo' : 'Inativo'}
            </span>
            <button
              onClick={() => navigate(`/users/${userData.id}/edit`)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              Editar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  )}
                >
                  <TabIcon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Informações Pessoais */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Informações Pessoais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Nome Completo
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {userData.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Email
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {userData.email}
                        </p>
                      </div>
                    </div>
                    {userData.phone && (
                      <div className="flex items-center space-x-3">
                        <PhoneIcon className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Telefone
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {userData.phone}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center space-x-3">
                      <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Função
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {roleConfig.label}
                        </p>
                      </div>
                    </div>
                    {userData.badgeNumber && (
                      <div className="flex items-center space-x-3">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Número do Crachá
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {userData.badgeNumber}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center space-x-3">
                      <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Data de Criação
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(userData.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status e Estatísticas */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Status
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Status da Conta
                      </span>
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        userData.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                      )}>
                        {userData.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Último Acesso
                      </span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {userData.lastLogin ? formatDateTime(userData.lastLogin) : 'Nunca'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Atualizado em
                      </span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {formatDateTime(userData.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Atividades Recentes
              </h3>
              <div className="text-center py-8">
                <ClockIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Funcionalidade de atividades será implementada em breve
                </p>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Histórico do Usuário
              </h3>
              <div className="text-center py-8">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Histórico detalhado será implementado em breve
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UserDetail;