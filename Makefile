install:
	@echo "Installing dependencies..."
	bun install
	@echo ""
	@echo "Installing web dependencies..."
	cd web && bun install

dev:
	bun dev

up:
	@bash scripts/up.sh

down:
	@bash scripts/down.sh
