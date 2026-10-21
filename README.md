# PALLET·LAB — proyecto completo

Todo lo de PALLET·LAB en una carpeta, listo para abrir en Claude Code.

## Qué hay aquí
| Carpeta o archivo | Qué es |
|---|---|
| `pallet-lab.html` | La herramienta, versión del 17 de octubre de 2026. Es la base para todo cambio y se abre con doble clic. |
| `CLAUDE.md` | Las reglas que Claude Code lee solo: un solo archivo HTML, sin precios, solo White Fir y Pino Mexicano, los diseños guardados siempre deben abrir, y cada cambio en una rama que tú apruebas. |
| `docs/` | Historial de cambios (`CHANGELOG.md`), la nota de la decisión de usar solo PALLET·LAB y tu checklist en Excel. |
| `history/` | Todas las versiones anteriores, numeradas del 01 al 10. La 10 es igual a `pallet-lab.html`. |
| `tests/` | Pruebas automáticas, incluidos 18 diseños guardados con versiones anteriores. |

## Para empezar en Claude Code
1. Descomprime el zip y abre la carpeta `pallet-lab` en Claude Code.
2. Escribe: *"Lee README.md y CLAUDE.md. Luego corre las pruebas: cd tests && npm install && npm test && npm run compare."* Todas deben terminar con `failed checks: 0`.
3. Escribe: *"Inicia git en esta carpeta, haz el primer commit y márcalo con la etiqueta 2026-10-17."*

## Para reestructurar
Pide un plan antes de mover nada, por ejemplo:

> Propón cómo reestructurar este proyecto sin cambiar ningún resultado. Trabaja en una rama. Al terminar, `npm test`, `npm run compare` y `tests/browser/compare_drawings.py` deben salir sin diferencias contra `history/10_2026-10-17_master.html`.

- `npm run compare` corre 600 diseños en la versión aprobada y en la nueva. Compara capacidades, lista de materiales, detalles, advertencias, lista de corte, hojas impresas y archivos guardados.
- `compare_drawings.py` compara los dibujos píxel por píxel.
- Si el código se divide en varios archivos, lo que tú usas debe seguir siendo un solo `pallet-lab.html`. CLAUDE.md ya lo pide.

## Las pruebas
| Prueba | Qué revisa | Necesita |
|---|---|---|
| `npm test` (en `tests/`) | 2,000 diseños al azar, también con campos vacíos o con errores, sin fallas ni números inválidos; 300 acomodos de triplay en hojas; los 18 diseños guardados viejos | Node.js |
| `npm run compare` | que una versión nueva dé los mismos resultados que la aprobada | Node.js |
| `tests/browser/flows.py` | lista del navegador, archivos dañados, cambiar de tipo, imprimir | Python y Playwright |
| `tests/browser/printfit.py` | que la hoja de una tarima quepa en una página | Python y Playwright |
| `tests/browser/labels.py` | que no haya etiquetas encimadas o cortadas en los dibujos | Python y Playwright |
| `tests/browser/inputs_fit.py` | que cada campo muestre su valor completo | Python y Playwright |
| `tests/browser/compare_drawings.py` | que los dibujos sean iguales a los de la versión aprobada | Python y Playwright |

En Windows, el comando de Python suele ser `python` o `py` en lugar de `python3`; Claude Code lo ajusta solo.

## Respaldo
- Copia congelada en tu proyecto Cobaza Madera de Claude: `pallet-lab/pallet-lab-backup-2026-10-17.html`.
- `history/10_2026-10-17_master.html` en esta carpeta.

## Pendientes conocidos
- La capacidad con montacargas (FORK SUPPORT) no toma en cuenta las muescas, así que sale alta cuando las horquillas entran por ellas. Es la primera mejora de la checklist.
- Dibujo en pantalla: en cajas largas con cleats exteriores, la cota vertical "EXT" de la vista superior se corta en el borde izquierdo. Por ejemplo, una caja de 120×48. En la hoja impresa sale bien.
- Hoja impresa: cuando la muesca queda a 1″ del extremo y es corta (6″), las etiquetas "1″" y "6″" se enciman. Pasa en pocos casos.
- Mientras no se corrijan, `tests/browser/labels.py` los reporta: 1 caso con los 250 diseños de siempre.
