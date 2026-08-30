"""
alembic/env.py – Alembic migration environment.

This file is loaded by Alembic when running `alembic upgrade head` or
`alembic revision --autogenerate`. It configures the database connection
and points Alembic at our SQLAlchemy models so it can auto-detect schema changes.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ─── Make `app` importable from the alembic/ directory ───────────────────────
# Adds the backend/ directory (parent of alembic/) to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import models so Alembic can detect them in Base.metadata
from app.models import Base  # noqa: F401 – registers all models
from app.config import settings

# ─── Alembic Config ───────────────────────────────────────────────────────────
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override the sqlalchemy.url from the alembic.ini with the value from .env
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Target metadata for autogenerate support
target_metadata = Base.metadata


# ─── Offline Migration ────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode (emit SQL to stdout without a live DB connection).
    Useful for generating SQL scripts for review.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# ─── Online Migration ─────────────────────────────────────────────────────────
def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode (requires a live DB connection).
    This is the normal mode used by `alembic upgrade head`.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
