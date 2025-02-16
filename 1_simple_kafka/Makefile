SHELL := /bin/bash

.PHONY: run clean check

check:
	@if ! command -v docker >/dev/null 2>&1; then \
		echo "Error: Docker not found. Please install Docker."; \
		exit 1; \
	fi
	@if ! docker compose version >/dev/null 2>&1; then \
		echo "Error: Docker Compose (v2+) not found. Please install it."; \
		exit 1; \
	fi

run: check
	docker compose up -d

clean: check
	docker compose down
