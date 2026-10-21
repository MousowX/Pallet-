# PALLET·LAB — proyecto completo

Todo lo de PALLET·LAB en una carpeta, listo para abrir en Claude Code.

## Qué hay aquí
| Carpeta o archivo | Qué es |
|---|---|
| `pallet-lab.html` | La herramienta. Se abre con doble clic y funciona sin internet. Se genera desde `src/` con `node build.js`: no se edita a mano. |
| `src/` | El código de la herramienta, separado por partes: `css/` (estilos), `js/core`, `js/model` (cálculos), `js/render` (pantalla, dibujos e impresiones), `js/designs` (diseños guardados y su base de datos), `js/app`. |
| `build.js` | Junta `src/` en el único `pallet-lab.html`. |
| `CLAUDE.md` | Las reglas que Claude Code lee solo: un solo archivo HTML, sin precios, solo White Fir y Pino Mexicano, los diseños guardados siempre deben abrir, y cada cambio en una rama que tú apruebas. |
| `docs/` | Historial de cambios (`CHANGELOG.md`), la nota de la decisión de usar solo PALLET·LAB y tu checklist en Excel. |
| `history/` | Todas las versiones anteriores, numeradas del 01 al 12. La 12 es la versión aprobada contra la que se comparan los cambios. |
| `tests/` | Pruebas automáticas, incluidos 18 diseños guardados con versiones anteriores. |

## Para empezar en Claude Code
1. Descomprime el zip y abre la carpeta `pallet-lab` en Claude Code.
2. Escribe: *"Lee README.md y CLAUDE.md. Luego corre las pruebas: cd tests && npm install && npm test && npm run compare."* Todas deben terminar con `failed checks: 0`.
3. El proyecto está en GitHub (`MousowX/Pallet-`). Cada cambio va en su propia rama y tú apruebas cuándo entra a `main`.

## Lista de diseños (base de datos)
La sección DESIGNS guarda todos tus diseños en una base de datos dentro del navegador (IndexedDB). No necesita internet ni servidor, y funciona con doble clic.

- **Entra todo:** lo que guardas con SAVE HERE, cada archivo que guardas con SAVE FILE y cada archivo que abres con LOAD FILE. Los archivos quedan con su nombre, sin `.pltlab.json`.
- **IMPORT FILES TO THE LIST** mete muchos archivos `.json` de una vez, por ejemplo tu archivo de diseños por número de parte. El diseño que tienes en pantalla no cambia. Los archivos que no son diseños se cuentan y se saltan.
- **Buscador:** escribe parte del nombre, cliente, Part #, tipo o fecha. Con varias palabras busca las que tengan todas. No importan acentos ni mayúsculas: "penoles" encuentra "Peñoles". Esc borra la búsqueda.
- Si guardas un diseño con un nombre que ya existe, se actualiza y no se duplica.
- Los diseños que ya tenías guardados en el navegador pasan solos a la base la primera vez que abres esta versión. La lista vieja queda respaldada en el navegador.
- La base vive en este navegador y esta computadora. Si borras los datos del navegador, se borra también, así que los archivos `.json` siguen siendo tu respaldo.
- Si el navegador no permite la base de datos, la herramienta usa la lista vieja como antes. Si bloquea todo el almacenamiento, la lista se apaga y los archivos siguen funcionando.

## Lista compartida (Supabase) — piloto
Con la lista compartida, todas las computadoras ven los mismos diseños. Se guardan en una base de datos de Supabase, en su plan gratis. Mientras no esté configurada, la herramienta no muestra nada nuevo.

**Prepararla (una sola vez):**
1. En supabase.com crea una cuenta y un proyecto en el plan **Free**. La contraseña de la base de datos que te pide es solo para ti: no se la des a nadie ni la pongas en la herramienta.
2. Entra a **SQL Editor** → **New query**. Pega todo `supabase/schema.sql` y, al final, escribe en minúsculas los correos de las personas que la van a usar. Haz clic en **Run**.
3. En **Authentication**:
   - apaga el registro abierto ("Allow new users to sign up");
   - en **Users** → **Add user**, crea a cada persona con su correo y una contraseña, y marca que quede confirmada.
4. En la configuración del proyecto (**API Keys** o **Data API**), copia el **Project URL** y la llave **publishable** (también llamada **anon public**). Esas dos son públicas. La **secret** o **service_role** nunca va en la herramienta.
5. Ponlas en `src/js/designs/cloud-config.js` y corre `node build.js`, o pásamelas a mí.

**Usarla:**
- Arriba de DESIGNS: correo, contraseña y **SIGN IN TO THE SHARED LIST**. Mientras tengas sesión, todo lo que guardas, importas o abres entra a la lista compartida, y la búsqueda funciona igual que siempre.
- **⭱ COPY BROWSER LIST** sube los diseños que tenías guardados en ese navegador.
- Si un diseño con ese nombre lo guardó otra persona, la herramienta te pregunta antes de reemplazarlo. Para borrar, te avisa que se borra para todos.
- **SIGN OUT** te regresa a la lista del navegador. Sin internet, la herramienta lo avisa y sigue funcionando con la lista del navegador.

**Para decidir si vale la pena invertir:** en Supabase, **Table Editor** → `designs` muestra cada diseño, quién lo guardó (`updated_by`) y cuándo (`updated_at`).

**Límites del plan gratis:**
- 500 MB, que alcanzan para cientos de miles de diseños.
- Si nadie lo usa en una semana, el proyecto se pausa. Se reactiva desde el panel de Supabase.
- No incluye respaldos automáticos, así que guarda también tus archivos `.json`.

## Publicar en internet (Render o Vercel)
La herramienta también puede vivir en una página web. Se publica solo `pallet-lab.html` (como página principal); `history/`, `tests/` y `docs/` no se publican. Cada vez que algo entra a `main`, la página se actualiza sola.

- **Render** (`render.yaml`), sitio estático gratis: en render.com entra con tu cuenta de GitHub → **New** → **Blueprint** → elige el repositorio `MousowX/Pallet-` → **Apply**.
- **Vercel** (`vercel.json`): en vercel.com → **Add New** → **Project** → importa `MousowX/Pallet-` → **Deploy**. El plan gratis (Hobby) es solo para uso personal, no comercial; para la empresa se necesita el plan Pro.
- Los dos ya traen la configuración: no hay que escribir ningún comando.
- Los diseños guardados en la página web son aparte de los del archivo con doble clic: cada uno tiene su propia lista. Para pasarlos, usa **IMPORT FILES TO THE LIST** con tus archivos `.json`.
- La página necesita internet para abrir. El archivo con doble clic sigue funcionando sin internet.
- Para revisar la página publicada: `python tests/browser/flows.py https://tu-direccion/`.

## Para reestructurar
Pide un plan antes de mover nada, por ejemplo:

> Propón cómo reestructurar este proyecto sin cambiar ningún resultado. Trabaja en una rama. Al terminar, `npm test`, `npm run compare` y `tests/browser/compare_drawings.py` deben salir sin diferencias contra la versión aprobada más nueva de `history/`.

- `npm run compare` corre 600 diseños en la versión aprobada y en la nueva. Compara capacidades, lista de materiales, detalles, advertencias, lista de corte, hojas impresas y archivos guardados.
- `compare_drawings.py` compara los dibujos píxel por píxel.
- El código ya está dividido en `src/`. Lo que tú usas sigue siendo un solo `pallet-lab.html`, que `node build.js` genera; `npm test` revisa que esté al día.

## Las pruebas
| Prueba | Qué revisa | Necesita |
|---|---|---|
| `npm test` (en `tests/`) | que `pallet-lab.html` esté al día con `src/`; 2,000 diseños al azar, también con campos vacíos o con errores, sin fallas ni números inválidos; 300 acomodos de triplay en hojas; los 18 diseños guardados viejos; la lista de diseños | Node.js |
| `npm run compare` | que una versión nueva dé los mismos resultados que la aprobada | Node.js |
| `tests/browser/flows.py` | la lista de diseños y su base de datos (guardar, abrir, borrar, importar, buscar, la lista vieja que pasa a la base, almacenamiento bloqueado o lleno, dos pestañas), archivos dañados, cambiar de tipo, imprimir | Python y Playwright |
| `tests/browser/printfit.py` | que la hoja de una tarima quepa en una página | Python y Playwright |
| `tests/browser/labels.py` | que no haya etiquetas encimadas o cortadas en los dibujos | Python y Playwright |
| `tests/browser/inputs_fit.py` | que cada campo muestre su valor completo | Python y Playwright |
| `tests/browser/compare_drawings.py` | que los dibujos sean iguales a los de la versión aprobada | Python y Playwright |
| `tests/browser/cloud.py` | la lista compartida contra un Supabase de prueba local: entrar, guardar, abrir, borrar, importar, otra computadora, sesión que vence, sin internet, salir | Python y Playwright |

En Windows, el comando de Python suele ser `python` o `py` en lugar de `python3`; Claude Code lo ajusta solo.

## Respaldo
- Copia congelada en tu proyecto Cobaza Madera de Claude: `pallet-lab/pallet-lab-backup-2026-10-17.html`.
- `history/12_2026-10-21_master.html` en esta carpeta (la versión aprobada actual) y todas las anteriores.

## Pendientes conocidos
- La capacidad con montacargas (FORK SUPPORT) no toma en cuenta las muescas, así que sale alta cuando las horquillas entran por ellas. Es la primera mejora de la checklist.
- Dibujo en pantalla: en cajas largas con cleats exteriores, la cota vertical "EXT" de la vista superior se corta en el borde izquierdo. Por ejemplo, una caja de 120×48. En la hoja impresa sale bien.
- Hoja impresa: cuando la muesca queda a 1″ del extremo y es corta (6″), las etiquetas "1″" y "6″" se enciman. Pasa en pocos casos.
- Mientras no se corrijan, `tests/browser/labels.py` los reporta: 1 caso con los 250 diseños de siempre.
