# Revisão de segurança — Collab Hub

Data: 11/11/2026. Ambiente: código local e servidor http://localhost:3001.

## Resultado

Foram corrigidos problemas de acesso a dados, recuperação de conta, redirecionamento e empacotamento. A revisão encontrou caminhos que poderiam permitir exposição; **não há evidência, nesta revisão, de que alguém tenha explorado essas falhas**. Não foi realizada investigação de incidentes nem auditoria de infraestrutura de produção.

## O que foi corrigido

| Achado | Risco e condição anterior | Correção |
|---|---|---|
| Caixa de e-mails de desenvolvimento sem autorização — alto em ambientes dev expostos | `/dev/mailbox` podia renderizar e-mails de outras contas, inclusive links de recuperação. O layout não exigia sessão. Em produção a página já era desativada. | Exige sessão de administrador, além de continuar indisponível em produção. Visitantes e usuários comuns recebem a tela de conteúdo não encontrado. |
| Mídias acessíveis apenas pelo conhecimento da URL — alto para conteúdo privado | O endpoint lia o arquivo sem verificar a visibilidade do conteúdo. Usava cache público de um ano, permitindo retenção após tornar um projeto privado ou remover um post. | Acesso exige proprietário do upload ou referência visível: perfil, organização, projeto ou publicação. Projetos privados exigem vínculo autorizado. Bloqueios são considerados para perfis/posts. Respostas usam `private, no-store`. |
| Reutilização concorrente de tokens — médio | Duas requisições podiam validar o mesmo token antes de qualquer uma marcá-lo como usado. | Consumo condicional atômico dentro de transação; verificação de expiração novamente no consumo. Bloqueio da linha da conta serializa emissão e alterações de credenciais. |
| Links antigos mantidos após mudança de credenciais — alto se alguém detém um link antigo | Recuperação enviada ao endereço anterior podia continuar válida após troca de e-mail. Mudança de senha autenticada não invalidava recuperações pendentes. | Troca de e-mail invalida todos os tokens anteriores; troca de senha invalida recuperações pendentes. Emissão confere novamente o endereço após adquirir o bloqueio. Recuperação rejeita contas suspensas ou excluídas no momento do consumo. |
| Tentativas de senha em operações sensíveis sem limite uniforme — médio | Troca de e-mail, desativação e exclusão validavam a senha atual sem um limite comum por conta. | A verificação de senha nessas operações passa pelo limitador persistente, independente do IP informado. |
| Autocomplete de menções ignorava privacidade — médio | Usuários bloqueados ou que desativaram a descoberta ainda apareciam nas sugestões. | Consulta filtra bloqueios, `searchable`, status e visibilidade antes de limitar os resultados. Respostas personalizadas não são armazenadas em cache. |
| Redirecionamento pós-login ambíguo — médio | A validação textual de `next` não cobria caracteres de controle que o parser de URL elimina, podendo transformar um destino aparentemente relativo em externo. | Validação com parser de URL, mesma origem e rejeição de barras invertidas/caracteres de controle. Caminhos internos, busca e fragmento continuam funcionando. |
| E-mails e exceções retidos com dados sensíveis — médio | O corpo integral dos e-mails, inclusive tokens e prévias de mensagens, era persistido em produção; erros de SMTP/driver podiam conter dados privados. | Novos registros de produção guardam metadados e um marcador no lugar do corpo. O envio ainda usa o texto original em memória. Erros persistidos de entrega são genéricos; detalhes de exceções são omitidos pelo logger em produção. Desenvolvimento mantém a caixa de testes. |
| Configurações de teste aplicáveis fora de testes — defesa adicional | `SCRYPT_FAST` e `RATE_LIMIT_MULTIPLIER` podiam reduzir proteções se definidos inadvertidamente em produção. | Só têm efeito quando `NODE_ENV=test`. Senhas novas fora de testes usam o custo normal. |
| Contexto Docker sem exclusões — risco de exposição de segredos de build | `COPY . .` sem `.dockerignore` incluía arquivos locais como `.env` e uploads no contexto/estágio de build. Não foi comprovada exposição em uma imagem publicada. | Novo `.dockerignore` exclui variáveis locais, uploads, chaves, caches e artefatos de teste. |
| Dependência de desenvolvimento vulnerável — moderado segundo advisory | `npm audit` apontou oito entradas relacionadas à mesma vulnerabilidade transitiva de `minimatch` na cadeia do ESLint. | Override restrito a `@typescript-eslint/typescript-estree` para `minimatch` 11.0.1 e atualização do lockfile. Auditoria posterior: zero vulnerabilidades conhecidas. |

A imagem de avatar continua pública onde o produto já a mostra no resumo de perfil restrito. Um arquivo usado também em conteúdo público continua público por essa referência. O proprietário pode acessar seu próprio upload, inclusive antes da publicação.

## Validação

- Suíte completa de testes unitários e de integração: **71 testes aprovados em 10 arquivos**.
- Novos testes incluem uso concorrente de tokens, invalidação após troca de e-mail/senha, suspensão, imagens sem referência, mudança público → privado, bloqueios, exclusão de publicação, retenção de e-mails em produção e redirecionamentos malformados.
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado, incluindo a cadeia de ferramentas após o override.
- `npm audit`: zero vulnerabilidades conhecidas na consulta executada.
- HTTP local sem sessão: exportação de conta, mensagens e menções retornam 401. Mídia desconhecida retorna 404 com `no-store`.
- Caixa de e-mails: visitante e usuário comum não recebem o conteúdo. No usuário comum foi confirmado o sinal de `notFound` do Next. Como a resposta já usa streaming, o HTTP pode ser 200 com tela de 404; não se deve interpretar o código isoladamente como autorização.
- Busca por valores exatos de credenciais configuradas nos 88 arquivos JavaScript/mapas cliente disponíveis em `.next/dev/static`: nenhuma correspondência. Esta verificação limitada não substitui um scanner completo de segredos nem cobre o histórico do repositório.

O banco de testes original, na porta 5432, falhou na preparação das migrations. Foi criado o banco separado `collab_security_audit_20261111` no servidor local configurado para desenvolvimento, na porta 55432. A suíte usou `TEST_DATABASE_URL` direcionada exclusivamente a esse banco; **os dados do banco principal não foram truncados**. Para a checagem HTTP autenticada, uma sessão temporária de usuário comum foi criada e removida ao final. Nenhuma mensagem ou publicação foi enviada.

## Arquivos principais

- `src/server/auth/service.ts`: consumo/emissão de tokens, invalidação e limites.
- `src/app/(app)/dev/mailbox/page.tsx`: autorização da caixa de desenvolvimento.
- `src/server/media-access.ts` e `src/app/api/media/[...key]/route.ts`: acesso às imagens.
- `src/app/api/mentions/route.ts`: filtros de privacidade.
- `src/lib/safe-redirect.ts` e `src/app/actions/auth.ts`: destinos seguros pós-login.
- `src/server/mail/mailer.ts` e `src/server/logger.ts`: redução da retenção sensível.
- `src/server/security/crypto.ts` e `rate-limit.ts`: isolamento de opções de teste.
- `.dockerignore`, `package.json`, `package-lock.json`: empacotamento e dependência.
- Testes em `tests/integration/auth.test.ts`, `media-access.test.ts`, `tests/unit/mail-security.test.ts` e `safe-redirect.test.ts`.

## Limites e cuidados de implantação

1. As correções estão no código local. Não houve deploy, build Docker, auditoria de hospedagem ou pentest externo. Os testes não garantem ausência de todas as vulnerabilidades.
2. Cópias de imagens já baixadas ou previamente armazenadas em cache não podem ser recolhidas pelo código. Se existirem CDN/proxy em produção, purgar os caches antigos ao implantar.
3. A omissão do corpo de e-mail vale para novos registros em produção. Registros históricos, backups e logs antigos precisam de uma política de retenção/redação no ambiente real. Não apaguei a caixa local nem históricos sem contexto operacional.
4. Hashes antigos eventualmente gerados com `SCRYPT_FAST` não são fortalecidos retroativamente. Se isso ocorreu em produção, será necessário rehash no login ou redefinição de senha.
5. O servidor ainda usa cabeçalhos encaminhados para identificar IP. A infraestrutura deve sobrescrever esses cabeçalhos e impedir acesso direto indevido ao backend. Essa configuração externa não foi verificada.
6. O CSP existente permite scripts inline para o Next. Uma migração para nonces exige revisar a estratégia de cache/renderização; não foi incluída nesta correção. Também não foi feita revisão exaustiva de todas as transições concorrentes de autorização.
7. Não foi encontrado um repositório Git no projeto nesta sessão; não foi auditado histórico de commits. A ausência de valores exatos no bundle local não comprova ausência de segredos em versões anteriores.

## Referências

- Documentação de segurança do Next.js distribuída com a versão instalada: `node_modules/next/dist/docs/01-app/02-guides/data-security.md`.
- [Advisory do minimatch: GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), consultado durante a revisão. O advisory identifica 11.0.1 como versão corrigida.
