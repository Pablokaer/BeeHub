# BeeHub · Colmeia

_BeeHub was called Collab Hub when this direction was approved; the prototype and prompts below keep the old name._

A referência aprovada reúne o feed e o perfil com molduras escalonadas, gotas de mel, retratos em favos e arte em pixel. O catálogo oferece imagens locais para seleção voluntária de capa e avatar.

## Referências aprovadas

| Arquivo | Uso |
| --- | --- |
| [Protótipo interativo](reference/prototipo-aprovado.html) | Abra no navegador. No feed, selecione **Ver perfil** no card da Ana. Confira **Publicações**, **Projetos**, **Sobre** e o tema **Noite**. Os dados e as ações no HTML são de demonstração. |
| [Capa original](reference/capa-aprovada.png) | PNG de 2060 × 763 px entregue na conversa. Referência de composição, paleta e textura. |
| [Folha de retratos original](reference/avatares-aprovados.png) | PNG de 1254 × 1254 px entregue na conversa. A ordem dos quadrantes é âmbar, lavanda, óculos dourados e chapéu de palha, da esquerda para a direita e de cima para baixo. |
| [Prompt para implementação](prompt-implementacao.md) | Instrução pronta para o agente que trabalha no Collab Hub. |

O perfil é a referência mais importante. O avatar hexagonal atravessa a borda inferior da capa, os contadores levam à rede e os recortes dos cards continuam nas abas. Preserve a hierarquia para que ilustração, identidade da pessoa e ações tenham espaço para respirar. Use o feed para validar a relação entre navegação, publicador e cards laterais.

## Catálogo de mídia

O [manifesto](../../../public/brand/colmeia/catalogo.json) lista as capas e os avatares prontos para servir pelo BeeHub. As URLs começam em `/brand/colmeia/`. Cada entrada possui um `id` estável, rótulo, descrição, dimensões e URL. As capas têm um `focalPoint` com coordenadas normalizadas de 0 a 1, equivalentes a porcentagens de `object-position`.

- **Capas.** Costa ao entardecer, Lagoa ao amanhecer, Estufa de azulejos e Olival à hora azul. São panoramas WebP de até 1600 px de largura. Confira o ponto focal tanto no card resumido quanto no perfil completo e no recorte de edição.
- **Avatares.** Quatro retratos da folha aprovada e quatro novos retratos. Cada opção é um WebP quadrado de 256 px. A moldura em favo faz parte do componente, permitindo o mesmo aro em diferentes tamanhos.

Para integrar o catálogo, valide o identificador e a categoria no servidor, resolva a URL pelo manifesto e mantenha o fluxo atual de mídia própria com suas verificações de acesso e propriedade. A escolha de arte deve ser explícita e editável.

## Direção visual

| Função | Dia | Noite |
| --- | --- | --- |
| Fundo | `#F8DFA0` | `#241911` |
| Superfície | `#FFF4D7` | `#362419` |
| Cabeçalho | `#352217` | `#21150F` |
| Texto | `#342315` | `#FFEBCB` |
| Ação mel | `#FFC44C` | `#FFC44C` |

Use Pixelify Sans nos títulos curtos e IBM Plex Sans nos textos de leitura e controles. A Bia e a coroa pertencem à identidade visual da plataforma. Use cantos em degraus, filete duplo e favos nas áreas decorativas. Aplique nitidez pixelada às ilustrações do catálogo e renderização convencional às fotos enviadas pelas pessoas.

## Prompts das novas artes

O gerador de imagens integrado criou as três novas capas e a segunda folha de retratos. Estes são os prompts usados.

<details>
<summary>Lagoa ao amanhecer</summary>

> Use case stylized-concept. Original panorama for the Collab Hub community profile cover, companion to the user's attached Portuguese pixel art apiary at sunset; use it only as style/palette reference. Render a distinct scene, art only, an ultrawide landscape about 2.7:1. Dawn at a quiet lagoon and wildflower meadow, a small wooden apiary workshop with two ochre beehives and a hand-built boardwalk near the center-right, reflections in aquamarine water, terraced hills and lavender in the foreground, a light peach and gold sky with subtle purple shadows. Two or three tiny honeybees with sparse cream pixel flight paths. Interest across center horizontal band so it crops well. Rich authentic retro RPG pixel art with crisp pixel clusters, dithered tile details, distinctive foreground framing, no blur, no vector edges, no typography, no UI, no watermark. Give this scene its own composition and values. Output standalone artwork.

</details>

<details>
<summary>Estufa de azulejos</summary>

> Use case stylized-concept. Original ultrawide 2.7:1 landscape pixel art profile cover for the Collab Hub, companion to Portuguese apiary references. Golden afternoon inside an old Portuguese glasshouse, white blue tiled low walls, iron grid windows and planted beds of lavender, rosemary and blooming citrus. On a table left of center are capped honey jars, narrow honey dipper and an open shallow frame of wax comb. A couple small worker bees in sunlit air. Moss/leaf green, creme wax, warm amber, pale turquoise glass, sparse purple. Strong horizontal composition with main objects inside the central 60% of the height for crop friendly cover. Layered mature retro pixel art, true square pixels, purposeful color clusters, light dithering, no smooth gloss or blur. No human characters, no text, no UI frame, no watermark. Original setting.

</details>

<details>
<summary>Olival à hora azul</summary>

> Use case stylized-concept. Original ultrawide 2.7:1 profile cover art for a pixel beehive collaboration community. A little hillside apiary at blue hour in a Portuguese orchard, a glowing glass lantern suspended from an olive beside small rustic hives, a crescent over distant indigo ridges, fine silver stars, honey glow on the doorstep, dusk-blue and violet flowers, two bees around the lantern. Natural visual frame from olive canopy and shadowed foreground, lit subjects across the middle horizontal band to remain legible in short crops. Same rich fine 16-bit pixel art craft as a cozy independent RPG, deliberate square pixel clusters, crisp nearest-neighbor texture, indigo and muted lilac with amber light, no painterly blurring. No text, no logo, no watermark, no interface.

</details>

<details>
<summary>Quatro novos retratos</summary>

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original adult bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. Top LEFT light-brown adult beekeeper with short dark curls, green bandanna and honey-toned work jacket against a faded sage green tile. TOP RIGHT East Asian adult woman with short straight black hair and warm terracotta round glasses, cream apiarist collar and lavender scarf against a plum tile. BOTTOM LEFT tan adult with cropped silver-gray hair, freckles and lilac scarf, windbreaker in soft blue, against a coral rose tile. BOTTOM RIGHT dark-brown adult woman with long tight braids, vivid turmeric vest and one tiny botanical hair pin, against a deep teal tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

</details>

## Implementation notes (app)

- **Tokens and themes.** `src/app/globals.css` maps the Colmeia palette onto the existing semantic tokens (`--c-canvas`, `--c-surface`, `--c-ink`, …) for day and `[data-theme="dark"]` for night. The choice is stored in `localStorage` (`ch-theme`) and applied by an inline head script before first paint (`src/components/shell/theme.ts`). Pixelify Sans is self-hosted through `next/font`, so the CSP stays `font-src 'self'`.
- **Components.** `src/styles/colmeia.css` holds the frames (`.panel`, `.cm-frame`, `.cm-tile`), honey buttons (`.cm-gold`, `.cm-wax`), header drips, rail, honeycomb portraits (`.cm-hex`), covers, metrics and tabs. Frames are painted by pseudo-elements behind the content; elements are never clipped, so focus rings and hit areas stay intact. Pixel glyphs and the apiary are SVG (`src/components/colmeia/`).
- **Catalog art.** Profiles store catalog ids in `Profile.avatarArt` / `Profile.coverArt` (migration `20261117120000_profile_catalog_art`), separate from uploaded media keys. `src/lib/art-catalog.ts` is the only place that reads `catalogo.json` and resolves URLs. The form schema and `updateProfile` reject unknown ids, ids of the other kind, and an upload plus an illustration for the same slot. `src/lib/media.ts` and `assertOwnedMedia` are unchanged.
- **Language.** The interface stays in English; catalog labels and alt texts come from the manifest in Portuguese and are marked `lang="pt"`.
- **Captures.** `capturas/` has the approved reference next to the implementation at 1280, 1024, 768 and 390 px, day and night.
- **Round 2 (refinements).** Profile uses its own proportions (`.cm-shell:has(.cm-columns-profile)`: ≈ 15 % rail, 21 % right panel) and a 218 px cover with a faceted **Back** (previous in-app page, otherwise `/feed`, or `/discover` when signed out). Profile tiles form a mosaic (`.cm-tiles`, `auto-fit`, ≥ 17 rem per card) with honeycomb flanks from 546 px (`.cm-comb-tile`). Project thumbnails prefer the project cover, then its logo, then a pixel glyph per category. Light-theme module titles are honey cartridges; phones use the 3 × 2 navigation grid above the content (no bottom bar). The composer shows Image, Link, author and Post from the first render; post type and feed reason sit in the byline.
- **Comparisons.** `capturas/v2/antes-depois-*` compare the previous and current builds with the same isolated data (database `collab_hub_visual`: seeded demo plus one post by Diogo with `tests/e2e/fixtures/pixel-garden.webp` attached through the composer), account (Ana), width and theme. `capturas/v2/referencia-depois-*` put the approved prototype next to the current build.
- **Pixel portraits for profile photos.** Every new profile photo goes through a local filter (`src/server/media/pixel-portrait.ts`, sharp only, no external service): bust crop, 48 × 48 grid with a detail-preserving reduction, adaptive 14-colour palette weighted to the face and nudged toward the Colmeia tones (no histogram equalization, so skin tones are kept), flat catalog-style backdrop and cocoa contours, scaled ×6 to 288 px lossless WebP. The portrait key ends in `.px.webp` (rendered with crisp pixels); the re-encoded original is stored as a separate asset that is never attached, so only its owner can read it, and the portrait records it in `MediaAsset.sourceKey`. New avatar keys must be portraits; photos saved before this change stay until replaced. Covers are not filtered. `capturas/v2/filtro-retrato-pixel.png` shows the filter on two public-domain NASA portraits (Sally Ride and Mae Jemison, Wikimedia Commons), close-up and full frame.
- **Avatar studio and more covers (round 4).** The automatic pixel filter on uploaded photos was removed; photos are stored as photos again (older `.px.webp` portraits still render). Members can instead compose a pixel avatar in the studio (`src/lib/avatar/`: options, a small mask-based pixel engine with cocoa contours and edge shading, and a `v1-…` code stored as `custom:<code>` in `avatarArt`), served as SVG by `/api/avatars/<code>`. Twelve procedural pixel covers (`scripts/design/build-pixel-covers.mjs`) join the four painted ones in `catalogo.json`.
