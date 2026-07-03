import { defineConfig } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
  schema: 'server/prisma/schema.prisma',
  migrations: {
    path: 'server/prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://eqzhou@localhost:5432/scribe?schema=public',
  },
})
