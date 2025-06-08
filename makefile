.PHONY: install
install: 
	cd $(CURDIR)/mcp_server_dart && dart pub get && make build

.PHONY: build
build:
	cd $(CURDIR)/mcp_server_dart && make build

.PHONY: inspect
inspect:
	cd $(CURDIR)/mcp_server_dart && make inspect 
