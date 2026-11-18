# Collab Hub — pesquisa e direção de produto

Pesquisa documental: 11 de novembro de 2026. Direção: uma comunidade profissional com alma de colmeia. Este documento sintetiza fontes públicas; não substitui entrevistas, testes de usabilidade ou uma auditoria de acessibilidade. As referências têm datas diferentes e não constituem uma descrição exaustiva das interfaces atuais.

## 1. O problema que estamos resolvendo

O Collab Hub conecta pessoas, projetos, organizações e oportunidades. Seu diferencial deve ser transformar descoberta em colaboração concreta. A experiência precisa responder rapidamente: quem pode me ajudar, onde posso contribuir e qual é o próximo passo? A estética retro é uma camada de identidade sobre uma estrutura de rede social reconhecível.

## 2. Benchmark e decisões

| Referência | Evidência consultada | Tradução para o Collab Hub |
| --- | --- | --- |
| LinkedIn Design | Princípios de valor, simplicidade e confiança | Ações com nome explícito, leitura sóbria, dados reais e contexto profissional |
| Bluesky | Escolha de feeds e controle sobre a timeline | Manter a separação entre “For you” e novidades da rede; apresentar o motivo de recomendações já existente |
| Reddit | Descoberta por interesses e comunidades | Tornar pessoas, projetos e oportunidades destinos explícitos; tags continuam sendo os conectores disponíveis |
| Discord | Consistência entre dispositivos, formas e espaçamento | Avatares circulares para pessoas; identidades de projetos quadradas; padrões estáveis no mobile |
| Duolingo | Linguagem de formas e ilustração coerente | Um mascote original e uma paleta curta, aplicados de forma consistente nas áreas de acolhimento |
| NN/g | Reconhecimento é mais fácil que recordação | Ícones acompanhados de rótulos e destinos visíveis; nenhuma ação essencial depende de gesto secreto |
| W3C WCAG 2.2 | Contraste, cor, foco, tamanho de alvos e movimento | Texto legível, foco de teclado e animações opcionais para quem prefere movimento reduzido |

Interpretação: combinar esses princípios ajuda a aproximar o produto de convenções estabelecidas. Não há uma certificação única de “padrão do mercado”; desempenho, usabilidade e acessibilidade precisam ser medidos no produto final.

## 3. Arquitetura de experiência

- Navegação principal: Home, Discover, Opportunities, Network, Messages, Alerts. Preservar os destinos existentes evita reaprendizagem desnecessária.
- Feed: acolhimento compacto, atalhos de descoberta, compositor, seletor de feed e publicações. Recomendações ficam na coluna lateral no desktop.
- Descoberta: começar por intenção — conhecer pessoas, explorar projetos ou encontrar oportunidades. Aplicar os filtros já existentes e utilizar resultados reais.
- Perfil: identidade, contribuição, habilidades e projetos devem explicar o que a pessoa oferece antes de pedir uma conexão.
- Publicação: preservar autoria e publicação em nome de projetos/organizações; ações de interação continuam agrupadas sob o conteúdo.
- Confiança: preservar confirmação de e-mail, denúncias, bloqueios e permissões existentes.

## 4. Sistema visual: Pixel Garden

Interface clara fixa. Fundo quase branco #FAFBF7, superfícies brancas, verde principal #216044, verde suave #EAF2E4, vermelho-tomate #AF392E para destaques e amarelo-mel para a abelha. O vermelho decorativo da arte não substitui a semântica de erros. Não depender só de vermelho/verde para comunicar estado: combinar rótulo, ícone ou texto.

Texto corrido em IBM Plex Sans, com hierarquia e respiro. Monoespaçada apenas em pequenos rótulos e detalhes retro. Evitar fontes pixeladas em parágrafos, formulários e mensagens. Cartões discretos, bordas leves, botões verdes e foco visível. Pixel art em ilustrações, marca, flores e mascote; fotos e conteúdo dos membros preservam sua aparência original.

## 5. Bia, a abelha da comunidade

Bia representa contribuição mútua, pertencimento e construção coletiva. O conceito usa a vida em colônia da abelha como metáfora: diferentes contribuições sustentam o conjunto. Não significa que toda espécie de abelha seja social.

Silhueta: abelha acolhedora, antenas visíveis, asas claras, listras verde-floresta, corpo amarelo e lenço vermelho. Nome de trabalho: Bia. Tom de voz: gentil, direto, encorajador; sem culpa por ausência, pressão por streak ou notificações artificiais.

Usos implementados: abertura da página inicial e acolhimento do feed. Aplicações futuras: onboarding, primeira colaboração e estados vazios úteis. Evitar mascote flutuando sobre mensagens, cobrindo conteúdo ou aparecendo em cada publicação.

Animação implementada: pequena oscilação vertical com steps(4), duas repetições de 2,4 segundos. Para após 4,8 segundos; prefers-reduced-motion desativa. É movimento de um sprite estático, não uma sequência de frames de asas. Não usar flashes, sons automáticos ou movimento infinito sem controle.

## 6. Implementação desta rodada

- Tokens globais migrados de lavanda para verde, creme e tomate, mantendo o tema claro.
- Marca vetorial simplificada com contorno em degraus.
- Mascote PNG original gerado com ImageGen integrado ao repositório.
- Abertura pública com jardim quadriculado, flores pixeladas e Bia.
- Feed com boas-vindas compacto e acesso direto às três intenções de descoberta.
- Botões e superfícies compartilhadas alinhados à nova linguagem.
- Fluxos de dados e autorização existentes preservados; nenhuma métrica social fictícia acrescentada.

## 7. Validação e evolução

Nesta rodada: TypeScript, lint e build de produção passaram. Página inicial conferida no navegador com dados reais em 390, 768 e 1440 px, sem transbordamento horizontal nessas larguras. Mascote carregado com transparência. Inspeção visual de celular e desktop realizada; captura desktop entregue. O navegador headless do Playwright foi bloqueado pelo macOS; a verificação foi feita pelo navegador integrado. Feed autenticado e fluxos completos ainda não passaram por teste de ponta a ponta nesta rodada. Essas verificações não comprovam conformidade WCAG nem substituem pesquisa com usuários.

Próxima avaliação recomendada: cinco a oito participantes representando pessoas com projetos, colaboradores e organizações. Tarefas: encontrar alguém por habilidade, descobrir um projeto, publicar uma necessidade, alternar feed, enviar uma candidatura e encontrar uma conversa. Registrar sucesso sem ajuda, tempo, erros e confiança percebida. Esse plano ainda não foi executado.

Indicadores de produto propostos, ainda não medidos: conclusão do perfil; primeira conexão aceita; primeira contribuição; candidatura com resposta; retorno semanal; taxa de denúncias e bloqueios. Priorizar qualidade de conexões, e não apenas tempo de tela.

Checklist de QA antes de lançamento: 360, 390, 768, 1024 e 1440 px; zoom 200%; teclado; leitor de tela; contraste dos pares reais; imagem indisponível; rede lenta; feed vazio; texto longo; modo de movimento reduzido. Não declarar conformidade WCAG completa sem auditoria das páginas e estados.

Backlog sugerido, fora desta implementação: explicar recomendações em descoberta; controle mais granular de notificações; onboarding orientado a uma primeira colaboração; pesquisa com membros para validar o tom lúdico; estados adicionais do mascote somente quando houver função clara.

## Fontes

1. LinkedIn Design, Design principles: https://design.linkedin.com/design-principles.html
2. Bluesky, Algorithmic Choice with Custom Feeds, 27/07/2023: https://bsky.social/about/blog/7-27-2023-custom-feeds
3. Bluesky, Product Roadmap, 07/05/2024: https://bsky.social/about/blog/05-07-2024-product-roadmap
4. Reddit, Introducing Our Discover Tab, 24/02/2022: https://redditinc.com/news/introducing-our-discover-tab-a-new-way-to-use-reddit-and-find-more-communities
5. Discord, Squircles, Styles, and Spacing, 04/08/2026: https://discord.com/blog/improving-mobile-with-squircles-styles-and-spacing
6. Duolingo, Shape language: https://blog.duolingo.com/shape-language-duolingos-art-style/
7. NN/g, Memory Recognition and Recall in User Interfaces, 15/01/2024: https://www.nngroup.com/articles/recognition-and-recall/
8. W3C, WCAG 2.2: https://www.w3.org/TR/WCAG22/

## Produção da arte

Ferramenta: ImageGen integrada, sem CLI. Arquivo de produção: public/brand/bia-bee-v1.png. Componente: src/components/bee-mascot.tsx. Uma imagem raster estática com fundo transparente; movimento implementado em CSS. O prompt final está no arquivo bia-imagegen-prompt.txt, junto desta pesquisa.

## Revisão do mascote — versão 2

A pedido do usuário, Bia foi redesenhada como uma abelha de proporções naturais, com cabeça menor e corpo horizontal, sem roupas ou expressão infantil. Asset: public/brand/bia-bee-v2.png. Imagem produzida por ImageGen integrada. Aplicação reduzida para 128 px na abertura (104 px no celular) e 64 px no feed (52 px no celular). Flores e cartão decorativo superior removidos. A v1 permanece arquivada. TypeScript e lint passaram para os ajustes de layout.

## Equilíbrio de cores

Superfícies de leitura em branco e cinza neutro claro; texto em carvão neutro. Verde #2C624B reservado para ações, links e seleção. Vermelho argila #A8493C em pequenos detalhes e sinalização. Ilustração em fundo marfim #F6F3E9 para acompanhar o mel da abelha; verdes suaves ficam nas capas e no acolhimento. Bordas e sombras menos coloridas. Miniatura social alinhada à paleta.
