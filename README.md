# Observatorio 2026

Tablero colaborativo multiusuario con Firebase Firestore en tiempo real.

## Instalación local

```bash
npm install
npm run dev
```

## Variables de entorno

Crea un archivo `.env.local` con tus credenciales de Firebase:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Deploy en Vercel

1. Sube este proyecto a GitHub
2. Importa en vercel.com
3. Agrega las variables VITE_FIREBASE_* en Environment Variables
4. Deploy

## URL de acceso

Una vez desplegado, comparte:
```
https://tu-proyecto.vercel.app/?workspace=equipo-observatorio
```

## Funciones

- Sincronización en tiempo real entre usuarios
- Presencia: ve quién está conectado en vivo
- Indicador de "alguien está editando"
- Chat/comentarios por tarea
- Historial de actividad por usuario
- Explorador de categorías y subcarpetas dinámico
- Panel de control de progreso
