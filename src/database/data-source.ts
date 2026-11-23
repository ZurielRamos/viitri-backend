import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.options.js';

/**
 * DataSource usado por el CLI de TypeORM (generar y ejecutar migraciones).
 * Se ejecuta desde `dist/`, por eso los globs apuntan a archivos `.js`.
 */
export default new DataSource({
  ...databaseOptions((key) => process.env[key]),
  entities: [`${import.meta.dirname}/../**/*.entity.js`],
});
