# =========================================
# Pesquisa Eleitoral — Dockerfile
# Multi-stage build otimizado para produção
# =========================================

# Stage 1: Build/Install de dependências
FROM node:20-alpine AS deps

WORKDIR /app

# Instalar dependências nativas necessárias para alguns pacotes
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# =========================================
# Stage 2: Imagem de produção
# =========================================
FROM node:20-alpine AS runner

# Usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

WORKDIR /app

# Copiar dependências do stage anterior
COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules

# Copiar código-fonte
COPY --chown=appuser:nodejs . .

# Remover arquivos desnecessários em produção
RUN rm -rf .env.example .git* scripts/

# Variáveis de ambiente padrão (sobrescritas pelo docker-compose)
ENV NODE_ENV=production \
    PORT=4444

# Expor a porta da aplicação
EXPOSE 4444

# Mudar para usuário não-root
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4444/api/health || exit 1

# Comando de inicialização
CMD ["node", "server.js"]
