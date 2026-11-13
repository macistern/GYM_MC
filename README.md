# Fuerza

Registro de gimnasio listo para publicar en Vercel. Incluye alta/inicio de sesión por email, ejercicios personales, rutinas reutilizables, historial, notas, RM real y progreso.

## Probarlo localmente

Abrí `index.html` en el navegador. Sin configurar nada, funciona en modo demo y guarda los datos en ese navegador.

## Activar cuentas reales y datos sincronizados

1. Creá un proyecto en [Supabase](https://supabase.com/).
2. En un proyecto nuevo, ejecutá `supabase/schema.sql`. Si ya habías creado las tablas de una versión anterior, ejecutá `supabase/migration_workouts.sql` completo para sumar rutinas, notas, RM y guardados seguros.
3. En Authentication > Providers, dejá habilitado Email. Configurá la URL de tu web de Vercel en las Redirect URLs.
4. Copiá el Project URL y la anon public key desde Settings > API en `config.js`.
5. Subí esta carpeta a GitHub e importala desde Vercel, o arrastrala en la pantalla de despliegue de Vercel.

## Funciones principales

- Entrenamientos con fecha editable, notas y borradores locales.
- Rutinas guardadas que pueden iniciarse, editarse y eliminarse.
- Catálogo personal de ejercicios, con un listado sugerido que no duplica nombres existentes.
- RM real manual por ejercicio e historial de cargas.
- Progreso por grupo muscular y marcas personales.

## Antes de publicar

- Confirmá que ejecutaste la migración más reciente en Supabase.
- Verificá que las políticas RLS estén activas para que cada persona acceda sólo a sus datos.
- La clave de `config.js` debe ser únicamente la **anon/public key**. Nunca publiques una `service_role key`.

`config.js` usa solo la clave pública anon de Supabase. La protección real de los registros se hace con las políticas RLS incluidas en el SQL. Nunca agregues una service_role key al frontend.
