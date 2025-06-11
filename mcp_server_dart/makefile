.PHONY: setup
setup:
	flutter pub get && make compile

.PHONY: compile
compile:
	@ mkdir -p build && \
	dart compile exe bin/main.dart -o build/flutter_inspector_mcp

.PHONY: inspect
inspect:
	npx @modelcontextprotocol/inspector build/flutter_inspector_mcp --log-level=debug

.PHONY: inspect-verbose
inspect-verbose:
	npx @modelcontextprotocol/inspector build/flutter_inspector_mcp --log-level=debug --verbose

# Clean up any background processes
.PHONY: cleanup
cleanup:
	@echo "🧹 Cleaning up background processes..."
	@pkill -f flutter_inspector_mcp_server || true
	@echo "✅ Cleanup complete"
