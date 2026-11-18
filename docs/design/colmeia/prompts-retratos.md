# Prompts dos retratos do catálogo

Gere cada lote no mesmo gerador usado nos avatares atuais, **anexando `reference/avatares-aprovados.png`** como referência de estilo. Salve cada imagem como `lote-01.png`, `lote-02.png`… numa pasta e rode:

```bash
node scripts/design/avatar-library.mjs ingest <pasta>
```

O script recorta os quatro quadrantes na ordem do prompt (superior esquerdo, superior direito, inferior esquerdo, inferior direito), padroniza em 256 × 256 WebP e cadastra cada retrato no catálogo com as características do plano (`retratos-plano.json`). Se um retrato sair diferente do pedido (por exemplo, sem óculos), corrija as características dele no plano antes de importar, para os filtros ficarem certos. Um lote pode ser refeito e importado de novo; o retrato é substituído.

## Lote 01

- `retrato-001` (top left): Cabelo curto e chapéu de apicultor
- `retrato-002` (top right): Dreadlocks ruivo e bandana
- `retrato-003` (bottom left): Pixie rosa e antenas de abelha
- `retrato-004` (bottom right): Cachos longos e chapéu de palha

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT adult woman with fair skin, short neat hair in dark brown, wearing a beekeeper hat with a folded-up veil, a cream beekeeper jacket with navy trim, small gold hoop earrings, against a warm amber tile. TOP RIGHT young adult man with deep dark-brown skin, shoulder-length locs in copper ginger, wearing a patterned bandana, a soft sky blue utility jacket, headphones resting around the neck, against a coral rose tile. BOTTOM LEFT adult person with brown skin, a short pixie cut in dyed pastel pink, honey-tinted sunglasses, wearing a bee antennae headband, lavender overalls over a cream shirt, freckles across the cheeks, against a butter yellow tile. BOTTOM RIGHT older woman with light-brown skin and a few smile lines, long voluminous curls in chestnut brown, round wire glasses, wearing a woven straw sun hat, a honey turtleneck, a tiny nose ring, against a plum tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 02

- `retrato-005` (top left): Careca e coroa de flores
- `retrato-006` (top right): Cabelo longo liso loiro e barba cheia
- `retrato-007` (bottom left): Chanel azul e óculos quadrados
- `retrato-008` (bottom right): Lenço na cabeça e barba por fazer

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT young adult man with warm tan skin, a shaved bald head, a full trimmed beard, wearing a small wildflower crown, a cozy terracotta hoodie, a flower tucked behind one ear, against a plum tile. TOP RIGHT adult person with light olive skin, long straight hair in honey blonde, a full trimmed beard, a deep teal collared shirt, against a soft sky blue tile. BOTTOM LEFT young adult woman with light olive skin, a chin-length bob in dyed cobalt blue, chunky square glasses, a quilted plum vest, a honey-drop pendant necklace, against a peach tile. BOTTOM RIGHT adult man with fair skin, hair fully covered by the headwear, light stubble, wearing a softly draped headscarf, a coral work apron over a cream shirt, a tiny enamel bee pin, against a faded sage green tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 03

- `retrato-009` (top left): Coque e barba por fazer
- `retrato-010` (top right): Cabelo curto e boné
- `retrato-011` (bottom left): Tranças lilás e óculos redondos
- `retrato-012` (bottom right): Undercut e gorro

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT older person with deep dark-brown skin and a few smile lines, hair in a high bun in black, light stubble, a chunky olive green knit sweater, small gold hoop earrings, against a deep teal tile. TOP RIGHT young adult woman with brown skin, short neat hair in dark brown, honey-tinted sunglasses, wearing a canvas cap, a striped mustard scarf over a coat, headphones resting around the neck, against a mint tile. BOTTOM LEFT adult man with light-brown skin, long box braids in dyed lavender, a tidy mustache, round wire glasses, a cream beekeeper jacket with sage green trim, freckles across the cheeks, against a soft sky blue tile. BOTTOM RIGHT young adult person with warm tan skin, an undercut with a swept top in black, a tidy mustache, wearing a knitted beanie, a cream utility jacket, a tiny nose ring, against a warm amber tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 04

- `retrato-013` (top left): Cabelo longo ondulado e flor na orelha
- `retrato-014` (top right): Raspado grisalho e chapéu de apicultor
- `retrato-015` (bottom left): Black power verde e bandana
- `retrato-016` (bottom right): Rabo de cavalo e antenas de abelha

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT adult woman with warm tan skin, long wavy hair in auburn, navy overalls over a cream shirt, a flower tucked behind one ear, against a mint tile. TOP RIGHT older man with light olive skin and a few smile lines, a close buzz cut in silver gray, chunky square glasses, wearing a beekeeper hat with a folded-up veil, a soft sky blue turtleneck, against a warm amber tile. BOTTOM LEFT young adult person with fair skin, a big rounded afro in dyed mint green, wearing a patterned bandana, a cozy lavender hoodie, a honey-drop pendant necklace, against a coral rose tile. BOTTOM RIGHT adult woman with deep dark-brown skin, a swinging ponytail in dark brown, wearing a bee antennae headband, a honey collared shirt, a tiny enamel bee pin, against a lavender tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 05

- `retrato-017` (top left): Cabelo curto ruivo e chapéu de palha
- `retrato-018` (top right): Dreadlocks rosa e coroa de flores
- `retrato-019` (bottom left): Pixie e sardas
- `retrato-020` (bottom right): Cachos longos e piercing no nariz

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT young adult man with brown skin, short neat hair in copper ginger, a small goatee, honey-tinted sunglasses, wearing a woven straw sun hat, a quilted terracotta vest, small gold hoop earrings, against a butter yellow tile. TOP RIGHT adult person with light-brown skin, shoulder-length locs in dyed pastel pink, a small goatee, round wire glasses, wearing a small wildflower crown, a deep teal work apron over a cream shirt, headphones resting around the neck, against a plum tile. BOTTOM LEFT older woman with light-brown skin and a few smile lines, a short pixie cut in chestnut brown, a chunky plum knit sweater, freckles across the cheeks, against a soft sky blue tile. BOTTOM RIGHT young adult man with warm tan skin, long voluminous curls in chestnut brown, a striped coral scarf over a coat, a tiny nose ring, against a peach tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 06

- `retrato-021` (top left): Lenço na cabeça e óculos quadrados
- `retrato-022` (top right): Cabelo longo liso azul, jaqueta mostarda
- `retrato-023` (bottom left): Chanel branco e boné
- `retrato-024` (bottom right): Cachos curtos e óculos escuros

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT adult person with light olive skin, hair fully covered by the headwear, chunky square glasses, wearing a softly draped headscarf, a cream beekeeper jacket with olive green trim, a flower tucked behind one ear, against a plum tile. TOP RIGHT young adult woman with fair skin, long straight hair in dyed cobalt blue, a mustard utility jacket, against a soft sky blue tile. BOTTOM LEFT adult man with deep dark-brown skin, a chin-length bob in snow white, a full trimmed beard, wearing a canvas cap, sage green overalls over a cream shirt, a honey-drop pendant necklace, against a peach tile. BOTTOM RIGHT older person with brown skin and a few smile lines, short curly hair in black, a full trimmed beard, honey-tinted sunglasses, a cream turtleneck, a tiny enamel bee pin, against a faded sage green tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 07

- `retrato-025` (top left): Coque e gorro
- `retrato-026` (top right): Cabelo curto lilás e barba por fazer
- `retrato-027` (bottom left): Tranças e chapéu de apicultor
- `retrato-028` (bottom right): Undercut e bandana

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT young adult woman with brown skin, hair in a high bun in dark brown, round wire glasses, wearing a knitted beanie, a cozy navy hoodie, small gold hoop earrings, against a deep teal tile. TOP RIGHT adult man with light-brown skin, short neat hair in dyed lavender, light stubble, a soft sky blue collared shirt, headphones resting around the neck, against a mint tile. BOTTOM LEFT young adult person with warm tan skin, long box braids in black, light stubble, wearing a beekeeper hat with a folded-up veil, a quilted lavender vest, freckles across the cheeks, against a warm amber tile. BOTTOM RIGHT adult woman with light olive skin, an undercut with a swept top in auburn, chunky square glasses, wearing a patterned bandana, a honey work apron over a cream shirt, a tiny nose ring, against a coral rose tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 08

- `retrato-029` (top left): Cabelo longo ondulado grisalho e bigode
- `retrato-030` (top right): Raspado verde e chapéu de palha
- `retrato-031` (bottom left): Black power e coroa de flores
- `retrato-032` (bottom right): Rabo de cavalo ruivo e óculos redondos

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT older man with fair skin and a few smile lines, long wavy hair in silver gray, a tidy mustache, a chunky terracotta knit sweater, a flower tucked behind one ear, against a lavender tile. TOP RIGHT young adult person with deep dark-brown skin, a close buzz cut in dyed mint green, a tidy mustache, wearing a woven straw sun hat, a striped deep teal scarf over a coat, against a butter yellow tile. BOTTOM LEFT adult woman with deep dark-brown skin, a big rounded afro in dark brown, honey-tinted sunglasses, wearing a small wildflower crown, a cream beekeeper jacket with plum trim, a honey-drop pendant necklace, against a coral rose tile. BOTTOM RIGHT young adult man with brown skin, a swinging ponytail in copper ginger, round wire glasses, a coral utility jacket, a tiny enamel bee pin, against a plum tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 09

- `retrato-033` (top left): Cabelo curto rosa e brincos
- `retrato-034` (top right): Lenço na cabeça e fones de ouvido
- `retrato-035` (bottom left): Pixie e óculos quadrados
- `retrato-036` (bottom right): Cachos longos loiro e boné

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT adult person with light-brown skin, short neat hair in dyed pastel pink, olive green overalls over a cream shirt, small gold hoop earrings, against a butter yellow tile. TOP RIGHT older woman with warm tan skin and a few smile lines, hair fully covered by the headwear, wearing a softly draped headscarf, a mustard turtleneck, headphones resting around the neck, against a plum tile. BOTTOM LEFT young adult man with light olive skin, a short pixie cut in chestnut brown, a small goatee, chunky square glasses, a cozy sage green hoodie, freckles across the cheeks, against a soft sky blue tile. BOTTOM RIGHT adult person with fair skin, long voluminous curls in honey blonde, a small goatee, wearing a canvas cap, a cream collared shirt, a tiny nose ring, against a peach tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 10

- `retrato-037` (top left): Careca e flor na orelha
- `retrato-038` (top right): Cabelo longo liso branco e gorro
- `retrato-039` (bottom left): Chanel e óculos redondos
- `retrato-040` (bottom right): Cachos curtos e chapéu de apicultor

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT young adult woman with fair skin, a shaved bald head, a quilted navy vest, a flower tucked behind one ear, against a faded sage green tile. TOP RIGHT adult man with deep dark-brown skin, long straight hair in snow white, honey-tinted sunglasses, wearing a knitted beanie, a soft sky blue work apron over a cream shirt, against a deep teal tile. BOTTOM LEFT older person with brown skin and a few smile lines, a chin-length bob in black, round wire glasses, a chunky lavender knit sweater, a honey-drop pendant necklace, against a mint tile. BOTTOM RIGHT young adult woman with light-brown skin, short curly hair in dark brown, wearing a beekeeper hat with a folded-up veil, a striped honey scarf over a coat, a tiny enamel bee pin, against a warm amber tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 11

- `retrato-041` (top left): Coque lilás e bandana
- `retrato-042` (top right): Cabelo curto e antenas de abelha
- `retrato-043` (bottom left): Tranças e chapéu de palha
- `retrato-044` (bottom right): Undercut grisalho e coroa de flores

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT adult man with warm tan skin, hair in a high bun in dyed lavender, a full trimmed beard, wearing a patterned bandana, a cream beekeeper jacket with terracotta trim, small gold hoop earrings, against a deep teal tile. TOP RIGHT young adult person with light olive skin, short neat hair in black, a full trimmed beard, chunky square glasses, wearing a bee antennae headband, a deep teal utility jacket, headphones resting around the neck, against a mint tile. BOTTOM LEFT adult woman with light olive skin, long box braids in auburn, wearing a woven straw sun hat, plum overalls over a cream shirt, freckles across the cheeks, against a warm amber tile. BOTTOM RIGHT older man with fair skin and a few smile lines, an undercut with a swept top in silver gray, light stubble, wearing a small wildflower crown, a coral turtleneck, a tiny nose ring, against a lavender tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 12

- `retrato-045` (top left): Cabelo longo ondulado verde e óculos escuros
- `retrato-046` (top right): Raspado e óculos redondos
- `retrato-047` (bottom left): Lenço na cabeça e bigode
- `retrato-048` (bottom right): Rabo de cavalo rosa e bigode

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT young adult person with deep dark-brown skin, long wavy hair in dyed mint green, light stubble, honey-tinted sunglasses, a cozy olive green hoodie, a flower tucked behind one ear, against a lavender tile. TOP RIGHT adult woman with brown skin, a close buzz cut in dark brown, round wire glasses, a mustard collared shirt, against a butter yellow tile. BOTTOM LEFT young adult man with light-brown skin, hair fully covered by the headwear, a tidy mustache, wearing a softly draped headscarf, a quilted sage green vest, a honey-drop pendant necklace, against a plum tile. BOTTOM RIGHT adult person with warm tan skin, a swinging ponytail in dyed pastel pink, a tidy mustache, a cream work apron over a cream shirt, a tiny enamel bee pin, against a soft sky blue tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 13

- `retrato-049` (top left): Cabelo curto e boné
- `retrato-050` (top right): Dreadlocks e fones de ouvido
- `retrato-051` (bottom left): Pixie loiro e gorro
- `retrato-052` (bottom right): Cachos longos azul e óculos escuros

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT older woman with warm tan skin and a few smile lines, short neat hair in chestnut brown, chunky square glasses, wearing a canvas cap, a chunky navy knit sweater, small gold hoop earrings, against a peach tile. TOP RIGHT young adult man with light olive skin, shoulder-length locs in chestnut brown, a striped soft sky blue scarf over a coat, headphones resting around the neck, against a faded sage green tile. BOTTOM LEFT adult person with fair skin, a short pixie cut in honey blonde, wearing a knitted beanie, a cream beekeeper jacket with lavender trim, freckles across the cheeks, against a soft sky blue tile. BOTTOM RIGHT young adult woman with deep dark-brown skin, long voluminous curls in dyed cobalt blue, honey-tinted sunglasses, a honey utility jacket, a tiny nose ring, against a deep teal tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 14

- `retrato-053` (top left): Careca e chapéu de apicultor
- `retrato-054` (top right): Cabelo longo liso e bandana
- `retrato-055` (bottom left): Chanel e antenas de abelha
- `retrato-056` (bottom right): Cachos curtos lilás e chapéu de palha

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT adult man with brown skin, a shaved bald head, a small goatee, round wire glasses, wearing a beekeeper hat with a folded-up veil, terracotta overalls over a cream shirt, a flower tucked behind one ear, against a faded sage green tile. TOP RIGHT older person with light-brown skin and a few smile lines, long straight hair in black, a small goatee, wearing a patterned bandana, a deep teal turtleneck, against a peach tile. BOTTOM LEFT young adult woman with light-brown skin, a chin-length bob in dark brown, wearing a bee antennae headband, a cozy plum hoodie, a honey-drop pendant necklace, against a mint tile. BOTTOM RIGHT adult man with warm tan skin, short curly hair in dyed lavender, chunky square glasses, wearing a woven straw sun hat, a coral collared shirt, a tiny enamel bee pin, against a warm amber tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 15

- `retrato-057` (top left): Coque e coroa de flores
- `retrato-058` (top right): Cabelo curto e fones de ouvido
- `retrato-059` (bottom left): Tranças grisalho e óculos escuros
- `retrato-060` (bottom right): Lenço na cabeça e óculos redondos

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT young adult person with light olive skin, hair in a high bun in black, wearing a small wildflower crown, a quilted olive green vest, small gold hoop earrings, against a coral rose tile. TOP RIGHT adult woman with fair skin, short neat hair in auburn, a mustard work apron over a cream shirt, headphones resting around the neck, against a lavender tile. BOTTOM LEFT older man with deep dark-brown skin and a few smile lines, long box braids in silver gray, a full trimmed beard, honey-tinted sunglasses, a chunky sage green knit sweater, freckles across the cheeks, against a butter yellow tile. BOTTOM RIGHT young adult person with brown skin, hair fully covered by the headwear, a full trimmed beard, round wire glasses, wearing a softly draped headscarf, a striped cream scarf over a coat, a tiny nose ring, against a plum tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 16

- `retrato-061` (top left): Cabelo longo ondulado e flor na orelha
- `retrato-062` (top right): Raspado ruivo e boné
- `retrato-063` (bottom left): Black power rosa e óculos quadrados
- `retrato-064` (bottom right): Rabo de cavalo e gorro

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT adult woman with brown skin, long wavy hair in dark brown, a cream beekeeper jacket with navy trim, a flower tucked behind one ear, against a lavender tile. TOP RIGHT young adult man with light-brown skin, a close buzz cut in copper ginger, light stubble, wearing a canvas cap, a soft sky blue utility jacket, against a butter yellow tile. BOTTOM LEFT adult person with warm tan skin, a big rounded afro in dyed pastel pink, light stubble, chunky square glasses, lavender overalls over a cream shirt, a honey-drop pendant necklace, against a plum tile. BOTTOM RIGHT older woman with light olive skin and a few smile lines, a swinging ponytail in chestnut brown, wearing a knitted beanie, a honey turtleneck, a tiny enamel bee pin, against a soft sky blue tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 17

- `retrato-065` (top left): Cabelo curto e bigode
- `retrato-066` (top right): Dreadlocks loiro e chapéu de apicultor
- `retrato-067` (bottom left): Pixie azul e bandana
- `retrato-068` (bottom right): Cachos longos branco e antenas de abelha

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT young adult man with fair skin, short neat hair in chestnut brown, a tidy mustache, a cozy terracotta hoodie, small gold hoop earrings, against a peach tile. TOP RIGHT adult person with deep dark-brown skin, shoulder-length locs in honey blonde, a tidy mustache, honey-tinted sunglasses, wearing a beekeeper hat with a folded-up veil, a deep teal collared shirt, headphones resting around the neck, against a faded sage green tile. BOTTOM LEFT young adult woman with deep dark-brown skin, a short pixie cut in dyed cobalt blue, round wire glasses, wearing a patterned bandana, a quilted plum vest, freckles across the cheeks, against a deep teal tile. BOTTOM RIGHT adult man with brown skin, long voluminous curls in snow white, wearing a bee antennae headband, a coral work apron over a cream shirt, a tiny nose ring, against a mint tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 18

- `retrato-069` (top left): Careca e chapéu de palha
- `retrato-070` (top right): Cabelo longo liso e coroa de flores
- `retrato-071` (bottom left): Chanel lilás e cavanhaque
- `retrato-072` (bottom right): Cachos curtos e cavanhaque

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT older person with light-brown skin and a few smile lines, a shaved bald head, wearing a woven straw sun hat, a chunky olive green knit sweater, a flower tucked behind one ear, against a warm amber tile. TOP RIGHT young adult woman with warm tan skin, long straight hair in dark brown, chunky square glasses, wearing a small wildflower crown, a striped mustard scarf over a coat, against a coral rose tile. BOTTOM LEFT adult man with light olive skin, a chin-length bob in dyed lavender, a small goatee, a cream beekeeper jacket with sage green trim, a honey-drop pendant necklace, against a mint tile. BOTTOM RIGHT young adult person with fair skin, short curly hair in black, a small goatee, a cream utility jacket, a tiny enamel bee pin, against a lavender tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 19

- `retrato-073` (top left): Lenço na cabeça e óculos escuros
- `retrato-074` (top right): Cabelo curto grisalho e óculos redondos
- `retrato-075` (bottom left): Tranças verde e boné
- `retrato-076` (bottom right): Undercut e piercing no nariz

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT adult woman with fair skin, hair fully covered by the headwear, honey-tinted sunglasses, wearing a softly draped headscarf, navy overalls over a cream shirt, small gold hoop earrings, against a coral rose tile. TOP RIGHT older man with deep dark-brown skin and a few smile lines, short neat hair in silver gray, round wire glasses, a soft sky blue turtleneck, headphones resting around the neck, against a lavender tile. BOTTOM LEFT young adult person with brown skin, long box braids in dyed mint green, wearing a canvas cap, a cozy lavender hoodie, freckles across the cheeks, against a butter yellow tile. BOTTOM RIGHT adult woman with light-brown skin, an undercut with a swept top in dark brown, a honey collared shirt, a tiny nose ring, against a plum tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

## Lote 20

- `retrato-077` (top left): Cabelo longo ondulado ruivo e gorro
- `retrato-078` (top right): Raspado rosa e barba cheia
- `retrato-079` (bottom left): Black power e chapéu de apicultor
- `retrato-080` (bottom right): Rabo de cavalo e bandana

> Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask. TOP LEFT young adult man with warm tan skin, long wavy hair in copper ginger, a full trimmed beard, chunky square glasses, wearing a knitted beanie, a quilted terracotta vest, a flower tucked behind one ear, against a soft sky blue tile. TOP RIGHT adult person with light olive skin, a close buzz cut in dyed pastel pink, a full trimmed beard, a deep teal work apron over a cream shirt, against a peach tile. BOTTOM LEFT older woman with light olive skin and a few smile lines, a big rounded afro in chestnut brown, wearing a beekeeper hat with a folded-up veil, a chunky plum knit sweater, a honey-drop pendant necklace, against a faded sage green tile. BOTTOM RIGHT young adult man with fair skin, a swinging ponytail in chestnut brown, light stubble, honey-tinted sunglasses, wearing a patterned bandana, a striped coral scarf over a coat, a tiny enamel bee pin, against a deep teal tile. Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.

