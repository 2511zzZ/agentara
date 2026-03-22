install:
	@echo "Installing dependencies..."
	bun install
	@echo ""
	@echo "Installing web dependencies..."
	cd web && bun install
	@$(MAKE) tara-install

tara-install:
	@chmod +x scripts/tara.sh
	@mkdir -p ~/.local/bin
	@ln -sf "$(PWD)/scripts/tara.sh" ~/.local/bin/tara
	@echo "tara installed → ~/.local/bin/tara"
	@echo "Make sure ~/.local/bin is in your PATH."

dev:
	bun dev

up:
	@bash scripts/up.sh

down:
	@bash scripts/down.sh
