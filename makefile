.PHONY: install
install: 
	cd $(CURDIR)/mcp_server_dart && make setup

.PHONY: build
build:
	cd $(CURDIR)/mcp_server_dart && make compile

.PHONY: inspect
inspect:
	cd $(CURDIR)/mcp_server_dart && make inspect 
