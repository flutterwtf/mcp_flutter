install:
	cd forwarding_server && npm install && npm run build
	cd mcp_server && npm install && npm run build
	cd forwarding_server && npm run start
