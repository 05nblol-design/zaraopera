# Endpoints Faltantes no Backend

Este documento lista os endpoints que estão sendo chamados no frontend mas que podem não existir ou estar incompletos no backend.

## Endpoints Identificados como Faltantes ou Incompletos:

### 1. Upload de Avatar
- **Frontend chama:** `/api/upload/avatar`
- **Status:** ❌ NÃO ENCONTRADO no backend
- **Arquivo:** `frontend/src/pages/Profile.jsx:133`
- **Necessário:** Implementar endpoint para upload de avatar de usuário

### 2. Upload de Imagens do Teflon
- **Frontend chama:** `/api/upload/teflon-images`
- **Status:** ❌ NÃO ENCONTRADO no backend
- **Arquivo:** `frontend/src/pages/TeflonChange.jsx:130`
- **Necessário:** Implementar endpoint para upload de múltiplas imagens do teflon

### 3. Relatórios de Produção (rota alternativa)
- **Frontend chama:** `/api/production/reports/production-summary`
- **Status:** ❌ NÃO ENCONTRADO no backend
- **Arquivo:** `frontend/src/pages/Reports.jsx:315`
- **Observação:** Existe `/api/reports/production-summary` mas não `/api/production/reports/production-summary`
- **Necessário:** Padronizar as rotas ou criar alias

## Endpoints Existentes mas com Possíveis Problemas:

### 1. Relatórios - Dados de Produção
- **Frontend chama:** `/api/reports/production-data`
- **Status:** ✅ EXISTE no backend
- **Arquivo:** `server/routes/reports.js:126`

### 2. Relatórios - Eficiência do Turno Atual
- **Frontend chama:** `/api/reports/current-shift-efficiency`
- **Status:** ✅ EXISTE no backend
- **Arquivo:** `server/routes/reports.js:2413`

### 3. Relatórios - Métricas de Qualidade
- **Frontend chama:** `/api/reports/quality-metrics`
- **Status:** ✅ EXISTE no backend
- **Arquivo:** `server/routes/reports.js:18`

### 4. Relatórios - Performance de Máquinas
- **Frontend chama:** `/api/reports/machine-performance`
- **Status:** ✅ EXISTE no backend
- **Arquivo:** `server/routes/reports.js:208`

### 5. Relatórios - Dados de Manutenção
- **Frontend chama:** `/api/reports/maintenance-data`
- **Status:** ✅ EXISTE no backend
- **Arquivo:** `server/routes/reports.js:1954`

### 6. Relatórios - Produtividade do Operador
- **Frontend chama:** `/api/reports/operator-productivity`
- **Status:** ✅ EXISTE no backend
- **Arquivo:** `server/routes/reports.js:1335`

## Endpoints de Upload Existentes:

### 1. Upload de Imagem de Teste de Qualidade
- **Backend tem:** `/api/upload/quality-test-image`
- **Status:** ✅ IMPLEMENTADO
- **Arquivo:** `server/routes/upload.js:32`

### 2. Upload de Vídeo de Teste de Qualidade
- **Backend tem:** `/api/upload/quality-test-video`
- **Status:** ✅ IMPLEMENTADO
- **Arquivo:** `server/routes/upload.js:99`

## Recomendações:

1. **Implementar endpoints de upload faltantes:**
   - `/api/upload/avatar` para upload de avatar de usuário
   - `/api/upload/teflon-images` para upload de imagens do teflon

2. **Padronizar rotas de relatórios:**
   - Decidir se usar `/api/reports/` ou `/api/production/reports/`
   - Criar aliases se necessário para manter compatibilidade

3. **Verificar autenticação e permissões:**
   - Garantir que todos os endpoints tenham middleware de autenticação adequado
   - Verificar se as permissões estão corretas para cada endpoint

4. **Testar endpoints existentes:**
   - Verificar se todos os endpoints listados como existentes estão funcionando corretamente
   - Testar com dados reais para garantir que retornam o formato esperado pelo frontend

## Status Geral:
- ✅ **Endpoints Funcionais:** 15+
- ❌ **Endpoints Faltantes:** 3
- ⚠️ **Endpoints para Revisar:** 1

**Última atualização:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")