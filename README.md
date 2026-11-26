# Sorteo EDSA · Mobility Experience 2026

Sorteo visual para el evento. Las cuatro líneas del mapa son los cuatro ejes del evento (Telemetría, Recaudo, Gestión de flota y CCTV) y todas llegan a la **Estación Ganador**. Al sortear, un bus recorre una de las líneas y el tablero de destino va mostrando nombres. Los nombres pasan más lento a medida que el bus frena. Cuando el bus llega a la estación, aparece el ganador.

## Cómo usarlo

1. Abre `index.html` con doble clic en Chrome o Edge. No necesita internet ni servidor: las fuentes, el logo y la librería de Excel están incluidos.
2. La primera vez se abre **Configuración → Cargar lista**:
   - **Hoja de cálculo** (.xlsx, .xls, .ods, .csv): arrastra el archivo y elige las columnas *Nombre*, *Apellidos* (opcional) y *Dato secundario* (empresa o área, opcional). La app intenta detectarlas sola a partir del encabezado.
   - **Pegar texto**: una persona por línea. Para agregar la empresa, sepárala con tabulación (copiar y pegar desde Excel), `;` o `|`.
   - Los duplicados y las filas vacías se omiten automáticamente.
3. En **Premios y opciones** puedes cargar los premios en el orden en que se sortean, cambiar el título, elegir la duración del recorrido (6, 9 o 13 s) y definir los **ganadores por tirada**:
   - **1**: un bus recorre una línea completa y se revela un ganador.
   - **Más de 1** (por ejemplo 10): sale una flota de buses escalonados por las 4 líneas. Cada bus que llega a la estación revela un ganador en el tablero y en el marcador superior. Al final, una tarjeta muestra a todos los ganadores juntos, cada uno con el siguiente premio de la lista. La tirada dura unos 20 a 30 s sin importar la cantidad.
   - Si en la tarjeta final alguien no está presente, pulsa **Ausente** en su recuadro: queda registrado y se sortea al instante un reemplazo para ese puesto (conserva el mismo premio). Con tiradas grandes, el botón aparece al pasar el mouse sobre el recuadro.
   - Si quedan menos participantes que la cantidad pedida, salen sorteados todos los que quedan.
4. Cierra la configuración, pulsa **F** para pantalla completa y **barra espaciadora** para sortear.
5. Cuando aparece el ganador:
   - **Enter** o *Confirmar ganador*: se registra y sale del sorteo.
   - *No está presente · sortear de nuevo*: se registra como ausente y se sortea otra vez al instante.
6. En **Ganadores** puedes exportar los resultados a Excel, anular un resultado o devolver a un ausente al sorteo.

| Tecla | Acción |
|---|---|
| Espacio / Enter | Sortear · confirmar ganador |
| F | Pantalla completa |
| M | Silenciar o activar sonido |
| C | Configuración |

## Transparencia del sorteo

Los ganadores se eligen **antes** de que empiece la animación, con `crypto.getRandomValues` del navegador y muestreo por rechazo, así cada participante tiene exactamente la misma probabilidad. En tiradas de varios ganadores, la lista se baraja con Fisher-Yates criptográfico y se toman los primeros N: nadie puede salir dos veces en la misma tirada. La línea, el recorrido y los nombres del tablero son solo la puesta en escena. El nombre del ganador nunca aparece en el tablero antes de la llegada.

## Datos

La lista, los ganadores y los ausentes se guardan en el `localStorage` del navegador. Si recargas la página o se cierra por accidente, no se pierde nada. Para empezar de cero usa *Reiniciar sorteo* (borra los ganadores y mantiene la lista) o *Vaciar lista*.

> Usa el mismo navegador y la misma computadora en el ensayo y en el evento, o vuelve a cargar la lista en la máquina final.

## Estructura

```
index.html            Pantalla principal
css/styles.css        Estilos (colores y tipografías del manual de marca)
js/store.js           Estado, guardado y azar criptográfico
js/importer.js        Lectura de Excel/CSV/texto y exportación de ganadores
js/network.js         Mapa de líneas, buses y animación del recorrido
js/fx.js              Confeti y sonidos (sintetizados, sin archivos de audio)
js/app.js             Interfaz y flujo del sorteo
assets/logo/          Logos EDSA (vectores extraídos del manual de marca)
assets/fonts/         Satoshi (Fontshare) y Work Sans (Google Fonts)
vendor/               SheetJS 0.20.3 (lectura y escritura de Excel)
ejemplos/             Lista ficticia de 236 participantes para ensayar
```
