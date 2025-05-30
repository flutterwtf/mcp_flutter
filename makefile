# node server will be replaced by dart server in future versions
# install: 
# 	cd $(CURDIR)/mcp_server_dart && dart pub get && make build
# build:
# 	cd $(CURDIR)/mcp_server_dart && make build
# inspect:
# 	cd $(CURDIR)/mcp_server_dart && make inspect 
install:
	cd $(CURDIR)/mcp_server && npm install && npm run build
build:
	cd $(CURDIR)/mcp_server && npm run build
inspect:
	cd $(CURDIR)/mcp_server && npm run inspect 