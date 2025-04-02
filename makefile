install: 
	cd $(CURDIR)/forwarding-server && npm install && npm run build && \
	cd $(CURDIR)/mcp_server && npm install && npm run build 
forward: 
	cd $(CURDIR)/forwarding-server && npm run start
build:
	cd $(CURDIR)/mcp_server && npm run build
