# Auth Middleware Service - NestJS

Este servicio:

- Valida JWT
- Valida Roles
- Valida Permisos
- Funciona como API Gateway
- Protege módulos críticos
- Reenvía tráfico al backend interno

---

## Flujo

1. Frontend envía Bearer Token
2. Middleware valida JWT
3. Middleware cruza:
   - Usuario
   - Rol activo
   - Módulo
   - Permiso
4. Si tiene acceso:
   - reenvía petición al backend
5. Si no:
   - retorna 403

---

## Modelo relacional esperado

Rol
Usuario
Rol_Usuar
Rol_Modulo

Relación:

Usuario -> Rol_Usuar -> Rol -> Rol_Modulo

---

## Instalación

```bash
npm install
cp .env .env
npm run start:dev
```

## Endpoint Health

GET

```bash
/gateway/api/v1/health
```

## JWT esperado

```json
{
  "userId": 1,
  "activeRole": "ADMIN"
}
```

## Ejemplo Frontend Next.js

```ts
const response = await fetch(
  'http://localhost:4000/gateway/api/v1/ventas/guardar',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  },
);
```

## Mejoras futuras

- Redis cache de permisos
- Rate limiting
- Auditoría
- Multi tenant
- OpenTelemetry
- API Gateway dinámico
- Swagger