# Análise das Fórmulas de Produção

## Resumo Executivo
Este documento analisa todas as fórmulas de cálculo de produção encontradas no sistema para identificar inconsistências e propor padronizações.

## Fórmulas Identificadas

### 1. Backend - productionService.js
**Localização:** `server/services/productionService.js`

#### Fórmula Principal:
```javascript
// Usa dados reais do shiftData ao invés de calcular
const estimatedProduction = shiftData ? shiftData.totalProduction : 0;
```

#### Cálculo de Eficiência:
```javascript
const efficiency = totalMinutes > 0 ? Math.round((runningMinutes / totalMinutes) * 100) : 0;
```

**Status:** ✅ CORRETO - Usa dados reais do banco

### 2. Frontend - useRealTimeProduction.js
**Localização:** `frontend/src/hooks/useRealTimeProduction.js`

#### Fórmula de Produção (CORRIGIDA):
```javascript
// Agora usa dados da API ao invés de calcular localmente
currentProduction: Math.max(0, productionData.estimatedProduction || 0)
```

#### Fórmula de Produção Incremental (Fallback):
```javascript
const calculateIncrementalProduction = (elapsedMinutes, speed) => {
  return Math.max(0, Math.floor(elapsedMinutes * speed));
};
```

**Status:** ✅ CORRETO - Prioriza dados da API, usa cálculo local apenas como fallback

### 3. Frontend - Dashboard.jsx
**Localização:** `frontend/src/pages/Dashboard.jsx`

#### Fórmula de Produção:
```javascript
const production = Math.floor(runningMinutes * speed * 0.85); // 85% de eficiência média
```

**Status:** ⚠️ INCONSISTENTE - Usa cálculo local com eficiência fixa de 85%

### 4. Frontend - Reports.jsx
**Localização:** `frontend/src/pages/Reports.jsx`

#### Fórmula de Produção:
```javascript
const production = Math.floor(runningMinutes * speed * 0.85); // 85% de eficiência média
const efficiency = isRunning ? 85 + Math.random() * 15 : 0; // 85-100% para máquinas funcionando
```

**Status:** ❌ INCORRETO - Usa valores aleatórios e eficiência fixa

## Problemas Identificados

### 1. Inconsistência entre Dashboard e Reports
- **Dashboard:** Usa eficiência fixa de 85%
- **Reports:** Usa eficiência aleatória entre 85-100%
- **Solução:** Ambos devem usar dados reais da API

### 2. Cálculos Locais Desnecessários
- **Problema:** Dashboard e Reports calculam produção localmente
- **Solução:** Usar dados da API como o hook useRealTimeProduction

### 3. Valores Hardcoded
- **Problema:** Eficiência de 85% e tempo de turno de 720 minutos hardcoded
- **Solução:** Buscar configurações do banco ou calcular dinamicamente

## Recomendações de Padronização

### 1. Fonte Única da Verdade
- ✅ Backend (productionService.js) deve ser a única fonte de cálculos
- ✅ Frontend deve sempre consumir dados da API
- ✅ Cálculos locais apenas como fallback em caso de erro na API

### 2. Fórmulas Padronizadas

#### Produção:
```javascript
// CORRETO: Usar dados do shiftData
const production = shiftData.totalProduction;

// FALLBACK: Apenas se shiftData não existir
const fallbackProduction = runningMinutes * productionSpeed;
```

#### Eficiência:
```javascript
// CORRETO: Baseado no tempo real
const efficiency = totalMinutes > 0 ? (runningMinutes / totalMinutes) * 100 : 0;
```

#### Velocidade de Produção:
```javascript
// CORRETO: Usar velocidade configurada da máquina
const speed = machine.productionSpeed;
```

### 3. Configurações Dinâmicas
- Tempo de turno deve vir de configuração (não hardcoded 720 min)
- Eficiência deve ser calculada, não assumida
- Metas de produção devem vir do banco de dados

## Plano de Correção

### Fase 1: Corrigir Dashboard
1. Remover cálculos locais de produção
2. Usar hook useRealTimeProduction ou API diretamente
3. Remover eficiência hardcoded de 85%

### Fase 2: Corrigir Reports
1. Remover valores aleatórios de eficiência
2. Usar dados reais da API
3. Implementar cálculos consistentes

### Fase 3: Validação
1. Executar testes de sincronização
2. Verificar consistência entre todas as telas
3. Validar com dados reais de produção

## Status Atual
- ✅ Backend: Fórmulas corretas e consistentes
- ✅ useRealTimeProduction: Corrigido para usar API
- ⚠️ Dashboard: Precisa correção
- ❌ Reports: Precisa correção completa

## Próximos Passos
1. Corrigir Dashboard.jsx
2. Corrigir Reports.jsx
3. Executar testes de validação
4. Documentar fórmulas finais