const DEFAULT_DATABASE_SCHEMA = "dealflow360";
const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const POSTGRES_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

type DatabaseEnvironment = Readonly<Record<string, string | undefined>>;

export interface DatabaseSettings {
  connectionString: string;
  prismaUrl: string;
  schema: string;
}

export function getDatabaseSettings(
  environment: DatabaseEnvironment = process.env,
): DatabaseSettings {
  const rawDatabaseUrl = environment.DATABASE_URL?.trim();

  if (!rawDatabaseUrl) {
    throw new Error(
      "DATABASE_URL is required before the DealFlow360 database client can start.",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (!POSTGRES_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error(
      "DATABASE_URL must use the postgresql:// or postgres:// protocol.",
    );
  }

  const urlSchema = parsedUrl.searchParams.get("schema")?.trim();
  const environmentSchema = environment.DATABASE_SCHEMA?.trim();

  if (urlSchema && environmentSchema && urlSchema !== environmentSchema) {
    throw new Error(
      "DATABASE_SCHEMA must match the schema query parameter in DATABASE_URL when both are set.",
    );
  }

  const schema = environmentSchema || urlSchema || DEFAULT_DATABASE_SCHEMA;

  if (!POSTGRES_IDENTIFIER.test(schema)) {
    throw new Error(
      "DATABASE_SCHEMA must be a valid unquoted PostgreSQL identifier.",
    );
  }

  parsedUrl.searchParams.delete("schema");
  const connectionString = parsedUrl.toString();
  const prismaUrl = new URL(connectionString);
  prismaUrl.searchParams.set("schema", schema);

  return {
    connectionString,
    prismaUrl: prismaUrl.toString(),
    schema,
  };
}

export { DEFAULT_DATABASE_SCHEMA };
