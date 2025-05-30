setup:
	flutter pub get && make compile
compile: 
	dart compile exe bin/main.dart -o build/flutter_inspector_mcp
inspect:
	npx @modelcontextprotocol/inspector build/flutter_inspector_mcp