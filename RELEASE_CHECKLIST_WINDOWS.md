# OBS MASTER V3.2 RC1 — Checklist de liberación `.exe`

## Build e integridad

- [ ] Windows x64, Node.js LTS y red disponibles.
- [ ] `npm ci` o `npm install` (dependencias sincronizadas).
- [ ] `npm run lint` sin errores.
- [ ] `npm run test:core` con todas las pruebas aprobadas (base: 59).
- [ ] `npm run build` sin errores.
- [ ] `npm run desktop:server` compila el servidor sin Vite.
- [ ] `CREAR_EXE_WINDOWS.bat` genera instalador NSIS y portable reales.
- [ ] Instalador abre la app sin terminal, sin Vite ni Node externo.
- [ ] Instalar, desinstalar y reinstalar NO borran datos de AppData.

## Emisión

- [ ] Recuperar los datos migrados de `%APPDATA%`.
- [ ] Emparejar OBS WebSocket.
- [ ] Todas las fuentes existentes `localhost:3000/?overlay=...` cargan.
- [ ] Mostrar/ocultar fuentes con feedback de OBS.
- [ ] Transiciones reales instaladas en OBS.
- [ ] Cuenta regresiva, cinta animada, foto, logo e intro.
- [ ] Activación/detención de Virtual Camera.
- [ ] Minimizar a bandeja NO apaga overlays.
- [ ] Salir completamente libera el puerto 3000.
- [ ] No hay otra Vite ocupando el puerto 3000.
- [ ] StreamYard recibe la señal y mantiene la ruta de audio Mac.

## Rendimiento/seguridad

- [ ] Evaluar consumo CPU/GPU/memoria durante programa de ensayo.
- [ ] Revisión de accesibilidad y escalado Windows 125%/150%.
- [ ] Aplicación no escucha en IP LAN pública.
- [ ] Se han regenerado contraseñas antiguas filtradas por capturas.
- [ ] Resolver fuentes tipográficas externas para modo sin Internet.
- [ ] Firma de código/SmartScreen antes de distribuir públicamente.
- [ ] Backups comprobados y recuperación restaurando AppData.

## Resiliencia V3.2 (nuevas pruebas)

- [ ] Misión Control → Recovery Center: diagnóstico muestra el estado de datos sin solicitar la contraseña.
- [ ] Crear respaldo con cámara virtual inactiva; contiene station.json, library.json, medios y assets en AppData/backups.
- [ ] Cerrar, reabrir y comprobar los respaldos.
- [ ] Restaurar **solo en ensayo**, con OBS desconectado, escribiendo RESTAURAR. Reabrir la app y comprobar capítulo y multimedia.
- [ ] Intentar recuperación de una copia incompleta en ensayo: la app debe negarse a sobrescribir datos.
- [ ] Exportar informe de diagnóstico: sin contraseñas, IP de OBS ni contenidos de episodios.
- [ ] Con OBS Virtual Camera activa: cerrar con X => bandeja, fuentes siguen accesibles.
- [ ] Desde bandeja seleccionar «Salir completamente» y pulsar Cancelar => servidor sigue activo.
- [ ] Con StreamYard desconectado, salir de manera deliberada y comprobar liberación del puerto.
- [ ] Mover/redimensionar la ventana y abrir nuevamente: posición recuperada o reubicada si se desconectó el monitor.
- [ ] Prueba real de 75-90 minutos, incluido reinicio de OBS durante **ensayo privado**, no transmisión pública.
- [ ] Probar pérdida de Internet: si cambian tipografías, resolver fuentes offline antes de distribución externa.

## Bloqueos conocidos de RC1

- Sin prueba automatizada del empaquetado Electron dentro de Windows en este entorno.
- La aplicación usa fuentes web externas con fallback; no hay garantía de paridad visual offline.
- No hay firma digital del instalador ni sistema de actualizaciones automáticas.
- Los respaldos locales están limitados a 512 MB por copia; los videos más grandes requieren copia externa.
- La restauración es una operación de mantenimiento, no debe hacerse durante la emisión.
