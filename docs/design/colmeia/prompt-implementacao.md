# Prompt para o agente do Collab Hub

Implemente no Collab Hub em `<repo>` a direção visual **Colmeia** aprovada para o feed, o perfil e as superfícies sociais relacionadas. Entregue a interface no app Next.js existente, com os dados e os fluxos reais da plataforma. A prioridade visual é o perfil, tanto o card resumido no feed quanto a página completa e os cards de pessoas.

## Referências no projeto

1. Leia `AGENTS.md` e a documentação local do Next.js indicada nele. Leia `docs/design/colmeia/README.md` para a direção visual e o inventário.
2. Abra `docs/design/colmeia/reference/prototipo-aprovado.html` no navegador. Compare o feed inicial, o card **Ver perfil**, a página do perfil, suas três abas e o tema **Noite**. Use o protótipo como referência principal para proporções, composição, hierarquia, molduras, espaçamentos e estados. As artes originais estão no mesmo diretório.
3. Consuma `public/brand/colmeia/catalogo.json` e suas imagens locais como fonte única das quatro capas e dos oito avatares. `reference/capa-aprovada.png` e `reference/avatares-aprovados.png` são os PNGs originais. Os WebPs do catálogo são os arquivos para a interface. Reaproveite a Bia da marca nos lugares indicados pelo protótipo.

## Direção visual

Reproduza a linguagem do protótipo em componentes do app. O quadro claro usa âmbar de fundo `#F8DFA0`, cera `#FFF4D7`, cabeçalho cacau `#352217`, mel de ação `#FFC44C` e texto `#342315`. No tema noturno use fundo `#241911`, superfícies `#362419` e texto `#FFEBCB`, com contornos e ações em mel. Derive os tokens de superfície, borda, texto, foco e ação do CSS de referência e conecte-os aos tokens semânticos do projeto em `src/app/globals.css`. Use Pixelify Sans ou a fonte pixelada de referência nos títulos curtos e IBM Plex Sans no texto corrido. Carregue fontes no próprio domínio, com a infraestrutura do projeto, preservando a CSP existente.

Faça cantos escalonados com contorno duplo e filete de luz, gotas de mel no cabeçalho e favos nos cantos de molduras. Use ícones pequenos, discretos e reconhecíveis. Trate as imagens pixeladas do catálogo com recorte nítido, sem distorção. Mantenha fotos enviadas por usuários com renderização normal. As molduras são decorativas e devem ficar fora da área que recorta foco e alvos interativos.

Reproduza a composição junto com as cores. No protótipo largo, a navegação ocupa cerca de 17% do feed e o painel direito, cerca de 23%. No perfil, dê mais espaço à coluna central. Use capa de cerca de 200 px de altura e avatar de cerca de 110 px sobreposto em 44 px no desktop. No card lateral, a capa tem cerca de 84 px e o avatar, cerca de 70 px. Preserve a forma em favo do avatar, o aro em mel e cacau, os botões com pontas facetadas e os recortes em degraus mais marcados nos cards das abas. Ajuste os tamanhos pelo espaço disponível e compare o resultado renderizado com a referência.

## Feed, perfil e cards

- **Feed.** Refaça a composição em três colunas em tela larga, com navegação e cena do apiário à esquerda, publicador e posts no centro, perfil resumido, oportunidades e pessoas à direita. Use molduras em degraus e mantenha os modos atuais do feed, paginação e estados de carregamento ou vazio. Preserve as identidades de publicação, mídias, reações, comentários e ações de salvar. Use o conteúdo real do post para a mídia.
- **Card do próprio perfil.** Use faixa panorâmica, retrato hexagonal com aro duplo sobreposto à capa, nome, @usuário, profissão, métricas da rede e ação de abrir o próprio perfil. O avatar no cabeçalho usa o mesmo tratamento e mantém acesso à conta.
- **Perfil completo.** Use capa panorâmica, avatar em favo, identidade e ações junto da capa. Mostre conexões, seguidores e seguindo pelos dados permitidos ao visitante. As métricas abrem as listas reais. Organize Publicações, Projetos e Sobre segundo o protótipo, com cards recortados que se reorganizam conforme a largura. Preserve experiência, formação, habilidades, links, organizações, visibilidade, permissões e os estados de conexão. Reuse `RelationshipActions` e os destinos atuais de editar, conectar, seguir e enviar mensagem.
- **Superfícies relacionadas.** Estenda os mesmos tokens, bordas, avatares e estados aos cards de descoberta, rede, oportunidades, mensagens, notificações e salvos. Faça com que nome e avatar abram o perfil certo e mantenha as ações de conexão separadas. Use estados e números do servidor. Bia é a mascote. Mantenha a identidade do Collab Hub e o idioma atual da interface. Deixe ranking, XP, moedas e badges fictícios fora do escopo.

Comece pelo shell em `src/components/shell/`, por `src/app/(app)/feed/page.tsx`, `src/components/sidebar.tsx`, `src/components/post-card.tsx`, `src/app/(app)/u/[username]/page.tsx` e `src/components/ui/avatar.tsx`. Use componentes compartilhados para que o perfil, seus cards e os lugares onde o avatar aparece tenham a mesma linguagem. Use React, rotas e serviços existentes no lugar do código de simulação do protótipo.

## Catálogo de capa e avatar

Em `/profile/edit`, coloque opções acessíveis de escolher uma arte do catálogo, ver uma prévia, remover a seleção e enviar imagem própria. A escolha é voluntária. Grave apenas ao salvar o perfil. O fluxo de upload existente em `src/components/ui/image-upload.tsx`, com prévia, remoção, reencodificação e checagem de propriedade, continua funcionando para mídia personalizada.

Use as dimensões do manifesto e os pontos focais normalizados das capas para ajustar `object-position`. Confira a prévia do editor e o recorte de perfil nas duas larguras. O formulário deve deixar clara a opção selecionada e preservar a seleção anterior ao cancelar.

Modele as escolhas do catálogo como IDs validados por tipo no servidor e resolva somente as URLs locais cadastradas. Trate mídia enviada e arte de catálogo como fontes distintas. `src/lib/media.ts` resolve chaves de upload por `/api/media` e `src/server/profiles.ts` chama `assertOwnedMedia`. Preserve essa autorização e mantenha o resolvedor de upload livre de caminhos e URLs do catálogo. Escolhas inválidas ou de categoria trocada falham de modo explícito. Perfis anteriores mantêm a imagem, a ausência de mídia ou o fallback que já tinham. Valide a persistência, a substituição em ambas as direções e a remoção. Faça migração de dados somente se a solução escolhida exigir, com valores compatíveis com registros existentes.

## Aceite

- Compare no navegador o feed, card resumido e perfil aberto com a referência, lado a lado, nos dois temas. Confira 1280 px, 1024 px, 768 px e 390 px, com uma verificação de overflow em 320 px. Em tela estreita, preserve a navegação, deixe o conteúdo principal antes dos complementos e reorganize cards e métricas em uma coluna ou linha própria conforme o espaço.
- Mantenha navegação por teclado, foco visível nos dois temas, rótulos acessíveis, contraste WCAG AA e alvos de toque de aproximadamente 44 px. Teste abas, seleção de arte, diálogo e retorno de foco. Persista a preferência de tema sem flash durante navegação ou recarga.
- Rode `npm run typecheck` e `npm run lint`. Use as suítes `tests/e2e/mobile.spec.ts`, `tests/e2e/profile-presets.spec.ts`, `tests/integration/media-access.test.ts` e `tests/integration/social.test.ts` com a infraestrutura de teste do projeto. Cubra o novo caso de escolha e persistência de uma arte, rejeição de ID desconhecido ou da categoria errada e preservação da autorização de uploads. Confira também o perfil visitado por outra conta. Entregue capturas do feed e do perfil em desktop e mobile, lista curta dos arquivos alterados e resultados da verificação.
