install: 
	cd $(CURDIR)/mcp_server_dart && dart pub get && make build
build:
	cd $(CURDIR)/mcp_server_dart && make build
inspect:
	cd $(CURDIR)/mcp_server_dart && make inspect 
