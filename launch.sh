#!/usr/bin/env bash
exec gunicorn app:app --chdir src/backend --bind 127.0.0.1:8000 --workers 2 --threads 4 --timeout 30 --access-logfile -